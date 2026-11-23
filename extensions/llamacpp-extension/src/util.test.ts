import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildEmbedBatches,
  detectMtpLayersFromGgufMeta,
  detectExpertCountFromGgufMeta,
  resolveSpecDraftKind,
  detectTemplateKwargsFromChatTemplate,
  estimateTokensFromText,
  truncateToTokenBudget,
  fileName,
} from './util'
import { getBackendSetting } from './backend-settings'

vi.mock('./backend-settings')

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getBackendSetting).mockReset()
})

describe('truncateToTokenBudget', () => {
  it('returns input unchanged when under the budget', () => {
    expect(truncateToTokenBudget('hello world', 100, 3)).toBe('hello world')
  })

  it('slices to maxTokens * charsPerToken when over the budget', () => {
    const long = 'a'.repeat(1000)
    const out = truncateToTokenBudget(long, 10, 3)
    expect(out.length).toBe(30)
  })
})

describe('buildEmbedBatches', () => {
  it('packs small inputs into a single batch', () => {
    const batches = buildEmbedBatches(['hi', 'there'], 512, 3)
    expect(batches).toHaveLength(1)
    expect(batches[0]).toEqual({ batch: ['hi', 'there'], offset: 0 })
  })

  it('splits inputs across batches when token budget is exceeded', () => {
    const oneSafeChunk = 'a'.repeat(3 * 200)
    const batches = buildEmbedBatches(
      [oneSafeChunk, oneSafeChunk, oneSafeChunk],
      512,
      3
    )
    expect(batches.length).toBeGreaterThanOrEqual(2)
    const flat = batches.flatMap((b) => b.batch)
    expect(flat).toHaveLength(3)
    const offsets = batches.map((b) => b.offset)
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b))
  })

  it('truncates oversize inputs instead of forwarding them whole', () => {
    const huge = 'x'.repeat(20000)
    const batches = buildEmbedBatches([huge], 512, 3)
    expect(batches).toHaveLength(1)
    const sent = batches[0].batch[0]
    expect(sent.length).toBeLessThan(huge.length)
    expect(estimateTokensFromText(sent, 3)).toBeLessThanOrEqual(
      Math.floor(512 * 0.5)
    )
  })

  it('throws on ubatch_size too small to satisfy the safety margin', () => {
    expect(() => buildEmbedBatches(['hi'], 1, 3)).toThrow(/too small/)
  })
})

describe('detectExpertCountFromGgufMeta', () => {
  it('returns 0 for missing meta or a dense model', () => {
    expect(detectExpertCountFromGgufMeta(undefined)).toBe(0)
    expect(
      detectExpertCountFromGgufMeta({ 'general.architecture': 'llama' })
    ).toBe(0)
  })

  it('reads {arch}.expert_count, as a number or a string', () => {
    expect(
      detectExpertCountFromGgufMeta({
        'general.architecture': 'qwen3moe',
        'qwen3moe.expert_count': 128,
      })
    ).toBe(128)
    expect(
      detectExpertCountFromGgufMeta({
        'general.architecture': 'gpt-oss',
        'gpt-oss.expert_count': '32',
      })
    ).toBe(32)
  })

  // An arch-less key is not trusted: a draft or projector gguf can carry
  // another architecture's metadata, and a false positive breaks the load.
  it('ignores an expert_count under a different architecture', () => {
    expect(
      detectExpertCountFromGgufMeta({
        'general.architecture': 'llama',
        'other.expert_count': 8,
      })
    ).toBe(0)
  })
})

describe('detectMtpLayersFromGgufMeta', () => {
  it('returns 0 for undefined or empty meta', () => {
    expect(detectMtpLayersFromGgufMeta(undefined)).toBe(0)
    expect(detectMtpLayersFromGgufMeta({})).toBe(0)
  })

  it('reads {arch}.nextn_predict_layers when general.architecture is set', () => {
    expect(
      detectMtpLayersFromGgufMeta({
        'general.architecture': 'glm',
        'glm.nextn_predict_layers': '1',
      })
    ).toBe(1)
  })

  it('accepts numeric values', () => {
    expect(
      detectMtpLayersFromGgufMeta({
        'general.architecture': 'mimo',
        'mimo.nextn_predict_layers': 2,
      })
    ).toBe(2)
  })

  it('falls back to suffix scan when arch key is missing', () => {
    expect(
      detectMtpLayersFromGgufMeta({
        'some_new_arch.nextn_predict_layers': '3',
      })
    ).toBe(3)
  })

  it('returns 0 when value is zero, negative, or unparseable', () => {
    expect(
      detectMtpLayersFromGgufMeta({
        'general.architecture': 'glm',
        'glm.nextn_predict_layers': '0',
      })
    ).toBe(0)
    expect(
      detectMtpLayersFromGgufMeta({
        'general.architecture': 'glm',
        'glm.nextn_predict_layers': '-1',
      })
    ).toBe(0)
    expect(
      detectMtpLayersFromGgufMeta({
        'general.architecture': 'glm',
        'glm.nextn_predict_layers': 'abc',
      })
    ).toBe(0)
  })

  it('floors non-integer values', () => {
    expect(
      detectMtpLayersFromGgufMeta({
        'general.architecture': 'glm',
        'glm.nextn_predict_layers': '2.7',
      })
    ).toBe(2)
  })
})

describe('detectTemplateKwargsFromChatTemplate', () => {
  it('returns [] for missing or empty templates', () => {
    expect(detectTemplateKwargsFromChatTemplate(undefined)).toEqual([])
    expect(detectTemplateKwargsFromChatTemplate('')).toEqual([])
    expect(detectTemplateKwargsFromChatTemplate(123)).toEqual([])
  })

  it('detects the self-defaulting set idiom and infers types', () => {
    const tpl = [
      "{%- set enable_thinking = enable_thinking | default(false) -%}",
      "{%- set preserve_thinking = preserve_thinking | default(false) -%}",
      "{%- set reasoning_effort = reasoning_effort | default('medium') -%}",
      "{%- set max_turns = max_turns | default(8) -%}",
    ].join('\n')
    expect(detectTemplateKwargsFromChatTemplate(tpl)).toEqual([
      { name: 'preserve_thinking', type: 'boolean', default: false },
      { name: 'reasoning_effort', type: 'string', default: 'medium' },
      { name: 'max_turns', type: 'number', default: 8 },
    ])
  })

  it('excludes enable_thinking (owned by the reasoning control)', () => {
    const tpl = '{%- set enable_thinking = enable_thinking | default(true) -%}'
    expect(detectTemplateKwargsFromChatTemplate(tpl)).toEqual([])
  })

  it('deduplicates repeated kwargs and ignores non-self-defaulting sets', () => {
    const tpl = [
      '{%- set preserve_thinking = preserve_thinking | default(false) -%}',
      '{%- set preserve_thinking = preserve_thinking | default(false) -%}',
      '{%- set ns = namespace(x=1) -%}',
      '{%- set role = message.role -%}',
    ].join('\n')
    expect(detectTemplateKwargsFromChatTemplate(tpl)).toEqual([
      { name: 'preserve_thinking', type: 'boolean', default: false },
    ])
  })

  it('handles the {% %} form without the dash', () => {
    const tpl = '{% set add_notes = add_notes | default(true) %}'
    expect(detectTemplateKwargsFromChatTemplate(tpl)).toEqual([
      { name: 'add_notes', type: 'boolean', default: true },
    ])
  })
})

describe('resolveSpecDraftKind', () => {
  // general.architecture is what llama.cpp itself keys on: `eagle3` and
  // `dflash` are distinct architectures, and anything else carrying draft
  // weights is an MTP head.
  it('reads eagle3 straight off the architecture', () => {
    expect(resolveSpecDraftKind({ 'general.architecture': 'eagle3' })).toBe(
      'eagle3'
    )
  })

  it('reads dflash off the architecture', () => {
    expect(resolveSpecDraftKind({ 'general.architecture': 'dflash' })).toBe(
      'dflash'
    )
  })

  // DSpark shares the dflash architecture and is told apart by its Markov
  // head, which is a tensor rather than a metadata key.
  it('separates dspark from dflash by the markov head', () => {
    expect(
      resolveSpecDraftKind({ 'general.architecture': 'dflash' }, {
        hasMarkovHead: true,
      })
    ).toBe('dspark')
    expect(
      resolveSpecDraftKind({ 'general.architecture': 'dflash' }, {
        hasMarkovHead: false,
      })
    ).toBe('dflash')
  })

  // The tensor is the evidence; the catalog's file naming is only a fallback
  // for when it could not be read.
  it('trusts the markov head over the file naming', () => {
    expect(
      resolveSpecDraftKind({ 'general.architecture': 'dflash' }, {
        hasMarkovHead: false,
        hint: 'dspark',
      })
    ).toBe('dflash')
    expect(
      resolveSpecDraftKind({ 'general.architecture': 'dflash' }, {
        hint: 'dspark',
      })
    ).toBe('dspark')
  })

  it('treats any other architecture as an MTP head', () => {
    expect(resolveSpecDraftKind({ 'general.architecture': 'deepseek2' })).toBe(
      'mtp'
    )
    expect(resolveSpecDraftKind({})).toBe('mtp')
    expect(resolveSpecDraftKind(undefined)).toBe('mtp')
  })

  // The architecture wins: a misnamed file must not select a type the draft
  // cannot implement, which fails the load with an unrelated message.
  it('ignores a hint the architecture contradicts', () => {
    expect(
      resolveSpecDraftKind({ 'general.architecture': 'glm4moe' }, { hint: 'dflash' })
    ).toBe('mtp')
    expect(
      resolveSpecDraftKind({ 'general.architecture': 'dflash' }, { hint: 'mtp' })
    ).toBe('dflash')
  })
})

describe('fileName', () => {
  it('takes the last segment of a POSIX or Windows path', () => {
    expect(fileName('/jan/models/imported/qwen.yml')).toBe('qwen.yml')
    expect(fileName('C:\\jan\\models\\qwen.gguf')).toBe('qwen.gguf')
  })

  it('returns a bare name unchanged', () => {
    expect(fileName('qwen.yml')).toBe('qwen.yml')
  })
})
