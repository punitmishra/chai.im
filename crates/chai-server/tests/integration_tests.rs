//! Integration tests for chai-server.
//!
//! These tests require a PostgreSQL database.
//! Set DATABASE_URL environment variable or use:
//! docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=chai_test postgres:15
//!
//! Run tests with: cargo test --package chai-server --test integration_tests

mod common;

use common::TestServer;
use serde_json::json;

/// Test health check endpoint.
#[tokio::test]
async fn test_health_check() {
    let server = match TestServer::start().await {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Skipping test - could not start server: {}", e);
            return;
        }
    };

    let client = server.client();
    let response = client.get(server.url("/health")).send().await.unwrap();

    assert!(response.status().is_success());
    let body: serde_json::Value = response.json().await.unwrap();
    assert_eq!(body["status"], "ok");
}

/// Test user search requires authentication.
#[tokio::test]
async fn test_user_search_requires_auth() {
    let server = match TestServer::start().await {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Skipping test - could not start server: {}", e);
            return;
        }
    };

    let client = server.client();

    // Try to search without auth header
    let response = client
        .get(server.url("/users/search"))
        .query(&[("q", "test")])
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), 401);
}

/// Test user search with valid auth.
#[tokio::test]
#[serial_test::serial]
async fn test_user_search_with_auth() {
    let server = match TestServer::start().await {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Skipping test - could not start server: {}", e);
            return;
        }
    };

    // Get database pool for test setup
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost/chai_test".into());
    let pool = sqlx::postgres::PgPool::connect(&database_url)
        .await
        .unwrap();

    // Create test users
    let (_, token) = common::create_test_user(&pool, "searcher_user").await.unwrap();
    common::create_test_user(&pool, "searchable_alice").await.ok();
    common::create_test_user(&pool, "searchable_bob").await.ok();

    let client = server.client();

    // Search for users starting with "searchable"
    let response = client
        .get(server.url("/users/search"))
        .query(&[("q", "searchable")])
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();

    assert!(response.status().is_success());
    let body: serde_json::Value = response.json().await.unwrap();
    let users = body["users"].as_array().unwrap();
    assert!(users.len() >= 2);

    // Cleanup
    common::cleanup_test_user(&pool, "searcher_user").await.ok();
    common::cleanup_test_user(&pool, "searchable_alice").await.ok();
    common::cleanup_test_user(&pool, "searchable_bob").await.ok();
}

/// Test user search returns empty for no matches.
#[tokio::test]
#[serial_test::serial]
async fn test_user_search_no_results() {
    let server = match TestServer::start().await {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Skipping test - could not start server: {}", e);
            return;
        }
    };

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost/chai_test".into());
    let pool = sqlx::postgres::PgPool::connect(&database_url)
        .await
        .unwrap();

    let (_, token) = common::create_test_user(&pool, "no_match_searcher").await.unwrap();

    let client = server.client();

    // Search for non-existent user
    let response = client
        .get(server.url("/users/search"))
        .query(&[("q", "nonexistent_xyz_12345")])
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();

    assert!(response.status().is_success());
    let body: serde_json::Value = response.json().await.unwrap();
    let users = body["users"].as_array().unwrap();
    assert!(users.is_empty());

    // Cleanup
    common::cleanup_test_user(&pool, "no_match_searcher").await.ok();
}

/// Test get user profile requires auth.
#[tokio::test]
async fn test_get_user_profile_requires_auth() {
    let server = match TestServer::start().await {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Skipping test - could not start server: {}", e);
            return;
        }
    };

    let client = server.client();

    // Try to get profile without auth
    let response = client
        .get(server.url("/users/00000000-0000-0000-0000-000000000000"))
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), 401);
}

/// Test get user profile.
#[tokio::test]
#[serial_test::serial]
async fn test_get_user_profile() {
    let server = match TestServer::start().await {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Skipping test - could not start server: {}", e);
            return;
        }
    };

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost/chai_test".into());
    let pool = sqlx::postgres::PgPool::connect(&database_url)
        .await
        .unwrap();

    let (user_id, token) = common::create_test_user(&pool, "profile_test_user").await.unwrap();

    let client = server.client();

    // Get own profile
    let response = client
        .get(server.url(&format!("/users/{}", user_id)))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();

    assert!(response.status().is_success());
    let body: serde_json::Value = response.json().await.unwrap();
    assert_eq!(body["username"], "profile_test_user");
    assert_eq!(body["id"], user_id);

    // Cleanup
    common::cleanup_test_user(&pool, "profile_test_user").await.ok();
}

/// Test WebSocket connection requires token.
#[tokio::test]
async fn test_websocket_requires_token() {
    let server = match TestServer::start().await {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Skipping test - could not start server: {}", e);
            return;
        }
    };

    // Try to connect without token
    let result = tokio_tungstenite::connect_async(&server.ws_url).await;

    // Should fail or return error
    match result {
        Ok((_, response)) => {
            // Some implementations return 401 in the response
            assert_ne!(response.status().as_u16(), 101);
        }
        Err(_) => {
            // Connection failed - expected
        }
    }
}

/// Test WebSocket connection with valid token.
#[tokio::test]
#[serial_test::serial]
async fn test_websocket_with_valid_token() {
    let server = match TestServer::start().await {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Skipping test - could not start server: {}", e);
            return;
        }
    };

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost/chai_test".into());
    let pool = sqlx::postgres::PgPool::connect(&database_url)
        .await
        .unwrap();

    let (_, token) = common::create_test_user(&pool, "ws_test_user").await.unwrap();

    // Connect with token
    let ws_url = format!("{}?token={}", server.ws_url, token);
    let result = tokio_tungstenite::connect_async(&ws_url).await;

    match result {
        Ok((_, response)) => {
            // Should successfully upgrade
            assert_eq!(response.status().as_u16(), 101);
        }
        Err(e) => {
            panic!("WebSocket connection failed: {}", e);
        }
    }

    // Cleanup
    common::cleanup_test_user(&pool, "ws_test_user").await.ok();
}

/// Test registration endpoint rejects duplicate usernames.
#[tokio::test]
#[serial_test::serial]
async fn test_register_duplicate_username() {
    let server = match TestServer::start().await {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Skipping test - could not start server: {}", e);
            return;
        }
    };

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost/chai_test".into());
    let pool = sqlx::postgres::PgPool::connect(&database_url)
        .await
        .unwrap();

    // Create existing user
    common::create_test_user(&pool, "existing_user").await.unwrap();

    let client = server.client();

    // Try to register with same username
    let response = client
        .post(server.url("/auth/register/start"))
        .json(&json!({
            "username": "existing_user"
        }))
        .send()
        .await
        .unwrap();

    // Should fail with conflict
    assert_eq!(response.status(), 409);

    // Cleanup
    common::cleanup_test_user(&pool, "existing_user").await.ok();
}
