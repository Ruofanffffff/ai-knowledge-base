# Requirements Document

## Introduction

This specification defines the requirements for updating the notes feature's LLM configuration to fully integrate ByteDance Volcengine (字节火山引擎) API services. The system currently has partial Volcengine support but needs configuration updates and testing to ensure all four model types (image analysis, text generation, video generation, and image generation) work correctly with the Volcengine API.

## Glossary

- **Volcengine**: ByteDance's cloud platform providing AI model services (字节火山引擎)
- **LLM_Client**: The client module responsible for making API calls to LLM providers
- **Multimodal_LLM**: LLM capable of processing both text and images
- **seed1.8**: Volcengine's multimodal model for image analysis
- **seedance-2.0**: Volcengine's model for video generation
- **seedream-4.5**: Volcengine's model for image generation
- **Qwen**: Alibaba's text generation model (保持现有)
- **Configuration**: Environment variables and config files controlling LLM behavior
- **API_Key**: Authentication token for Volcengine services (6505f3ad-9559-4cb6-a385-472e11092611)

## Requirements

### Requirement 1: Volcengine API Client Configuration

**User Story:** As a system administrator, I want to configure the Volcengine API client correctly, so that all model types can authenticate and communicate with Volcengine services.

#### Acceptance Criteria

1. WHEN the system initializes, THE Configuration SHALL load the Volcengine API key from environment variables
2. WHEN creating a Volcengine client, THE LLM_Client SHALL use the correct base URL (https://ark.cn-beijing.volces.com/api/v3/chat/completions)
3. WHEN making API requests, THE LLM_Client SHALL include proper authentication headers with the API key
4. WHEN the API key is missing, THE Configuration SHALL log a warning and prevent LLM operations
5. THE Configuration SHALL support separate timeout values for different model types (image: 30s, text: 10s, video: 60s, image-gen: 30s)

### Requirement 2: Image Analysis with seed1.8 Model

**User Story:** As a user, I want to analyze images using the Volcengine seed1.8 model, so that I can extract information from uploaded images.

#### Acceptance Criteria

1. WHEN analyzing an image, THE Multimodal_LLM SHALL use the seed1.8 model
2. WHEN sending image analysis requests, THE LLM_Client SHALL format requests in OpenAI-compatible format
3. WHEN receiving responses, THE LLM_Client SHALL parse Volcengine responses correctly
4. WHEN an image analysis request fails, THE LLM_Client SHALL retry up to 3 times with exponential backoff
5. WHEN image analysis completes, THE LLM_Client SHALL return structured results with content and token usage

### Requirement 3: Text Generation with Qwen Model

**User Story:** As a user, I want to generate and enhance text using the Alibaba Qwen model, so that I can improve my note content.

#### Acceptance Criteria

1. WHEN generating text, THE LLM_Client SHALL continue using the Qwen provider
2. WHEN making text generation requests, THE LLM_Client SHALL use the qwen-max model
3. THE Configuration SHALL maintain existing Qwen API key and settings
4. WHEN text generation completes, THE LLM_Client SHALL return formatted text content
5. THE LLM_Client SHALL support both plain text and JSON response formats for Qwen

### Requirement 4: Video Generation with seedance-2.0 Model

**User Story:** As a user, I want to generate videos using the Volcengine seedance-2.0 model, so that I can create video content from text descriptions.

#### Acceptance Criteria

1. WHEN generating videos, THE LLM_Client SHALL use the seedance-2.0 model
2. WHEN sending video generation requests, THE LLM_Client SHALL format requests according to Volcengine video API specifications
3. WHEN video generation is in progress, THE LLM_Client SHALL handle longer timeout periods (60 seconds)
4. WHEN video generation completes, THE LLM_Client SHALL return video URLs or identifiers
5. IF video generation fails, THEN THE LLM_Client SHALL provide descriptive error messages

### Requirement 5: Image Generation with seedream-4.5 Model

**User Story:** As a user, I want to generate images using the Volcengine seedream-4.5 model, so that I can create visual content from text prompts.

#### Acceptance Criteria

1. WHEN generating images, THE LLM_Client SHALL use the seedream-4.5 model
2. WHEN sending image generation requests, THE LLM_Client SHALL format requests according to Volcengine image generation API specifications
3. WHEN image generation completes, THE LLM_Client SHALL return image URLs or base64 data
4. THE LLM_Client SHALL support configuration options for image size, quality, and style
5. WHEN image generation fails, THE LLM_Client SHALL retry with exponential backoff

### Requirement 6: Provider Detection and Routing

**User Story:** As a developer, I want the system to automatically detect and route requests to the correct provider, so that model selection is seamless.

#### Acceptance Criteria

1. WHEN a model name contains "seed", THE LLM_Client SHALL detect the provider as "volcengine"
2. WHEN a model name contains "qwen", THE LLM_Client SHALL detect the provider as "qwen"
3. WHEN creating a client, THE LLM_Client SHALL select the appropriate base URL based on provider
4. WHEN building requests, THE LLM_Client SHALL use provider-specific request formats
5. WHEN parsing responses, THE LLM_Client SHALL use provider-specific parsing logic

### Requirement 7: Error Handling and Retry Logic

**User Story:** As a system operator, I want robust error handling for API failures, so that temporary issues don't break the user experience.

#### Acceptance Criteria

1. WHEN an API request fails with a retryable error (5xx, timeout), THE LLM_Client SHALL retry up to 3 times
2. WHEN retrying, THE LLM_Client SHALL use exponential backoff (1s, 2s, 4s)
3. WHEN an API request fails with a non-retryable error (401, 403, 400), THE LLM_Client SHALL fail immediately
4. WHEN all retries are exhausted, THE LLM_Client SHALL throw a descriptive error
5. WHEN errors occur, THE LLM_Client SHALL log error details for debugging

### Requirement 8: Configuration Validation

**User Story:** As a system administrator, I want configuration validation at startup, so that I can detect misconfigurations early.

#### Acceptance Criteria

1. WHEN the system starts, THE Configuration SHALL validate that required API keys are present
2. WHEN the Volcengine API key is missing, THE Configuration SHALL log a warning
3. WHEN the Qwen API key is missing, THE Configuration SHALL log a warning
4. THE Configuration SHALL validate that timeout values are positive integers
5. THE Configuration SHALL validate that model names are non-empty strings

### Requirement 9: Statistics and Monitoring

**User Story:** As a system operator, I want to monitor LLM usage statistics, so that I can track costs and performance.

#### Acceptance Criteria

1. WHEN API calls are made, THE LLM_Client SHALL track total calls, successful calls, and failed calls
2. WHEN responses are received, THE LLM_Client SHALL track total token usage
3. THE LLM_Client SHALL provide a method to retrieve current statistics
4. THE LLM_Client SHALL provide a method to reset statistics
5. THE LLM_Client SHALL calculate and report success rate as a percentage

### Requirement 10: Backward Compatibility

**User Story:** As a developer, I want the updated configuration to maintain backward compatibility, so that existing code continues to work.

#### Acceptance Criteria

1. THE Configuration SHALL maintain support for existing environment variable names
2. THE LLM_Client SHALL continue to support the existing API interface
3. WHEN legacy model names are used, THE LLM_Client SHALL map them to new providers
4. THE Configuration SHALL provide default values for all optional settings
5. WHEN configuration is invalid, THE LLM_Client SHALL fall back to safe defaults where possible
