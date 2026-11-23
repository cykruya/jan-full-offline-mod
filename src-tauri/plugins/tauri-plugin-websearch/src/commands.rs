use crate::provider::{clamp_count, create_provider, FetchedPage, SearchProvider, SearchResult};
use serde::Serialize;

#[derive(Debug, Clone, Serialize, thiserror::Error)]
#[error("WebSearchError: {message}")]
pub struct WebSearchError {
    pub message: String,
}

impl WebSearchError {
    fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

impl From<String> for WebSearchError {
    fn from(message: String) -> Self {
        Self::new(message)
    }
}

/// The backend the Web Search settings describe: `provider` names the API
/// format, `endpoint` the address that speaks it. The desktop searches only
/// there, so a call without either is refused instead of being served by a
/// backend's built-in address.
fn configured_backend(
    provider: Option<String>,
    api_key: Option<String>,
    endpoint: Option<String>,
) -> Result<Box<dyn SearchProvider>, WebSearchError> {
    let (Some(provider), Some(endpoint)) = (provider.filter(|p| !p.trim().is_empty()), endpoint.filter(|e| !e.trim().is_empty())) else {
        return Err(WebSearchError::new("Web search has no address or API format. Set them in Settings > Web Search."));
    };
    Ok(create_provider(Some(&provider), api_key, Some(endpoint))?)
}

/// Search the web and return normalized results. `provider`, `api_key` and
/// `endpoint` select the backend (see [`configured_backend`]).
#[tauri::command]
pub async fn web_search(
    query: String,
    count: Option<u64>,
    provider: Option<String>,
    api_key: Option<String>,
    endpoint: Option<String>,
) -> Result<Vec<SearchResult>, WebSearchError> {
    let query = query.trim();
    if query.is_empty() {
        return Err(WebSearchError::new("web_search 'query' must not be empty."));
    }
    let backend = configured_backend(provider, api_key, endpoint)?;
    let results = backend.search(query, clamp_count(count)).await?;
    Ok(results)
}

/// Fetch a web page by URL and return normalized, bounded readable content.
#[tauri::command]
pub async fn web_fetch(
    url: String,
    provider: Option<String>,
    api_key: Option<String>,
    endpoint: Option<String>,
) -> Result<FetchedPage, WebSearchError> {
    let url = url.trim();
    if url.is_empty() {
        return Err(WebSearchError::new("web_fetch 'url' must not be empty."));
    }
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err(WebSearchError::new(format!(
            "web_fetch 'url' must be an http(s) URL, got: {url}"
        )));
    }
    let backend = configured_backend(provider, api_key, endpoint)?;
    let page = backend.fetch(url).await?;
    Ok(page)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_backend_needs_both_an_api_format_and_an_address() {
        let address = || Some("https://search.example".to_string());
        assert!(configured_backend(Some("searxng".into()), None, address()).is_ok());
        for (provider, endpoint) in [(None, address()), (Some(" ".to_string()), address()), (Some("exa".to_string()), None), (Some("exa".to_string()), Some(String::new()))] {
            let err = configured_backend(provider, None, endpoint).err().unwrap();
            assert!(err.message.contains("Settings > Web Search"), "{}", err.message);
        }
    }
}
