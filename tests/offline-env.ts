// Tests are offline unless a particular test explicitly enables and stubs an integration.
process.env.ENABLE_CONTENT_SCANNING = 'false';
process.env.ENABLE_DOMAIN_INTELLIGENCE = 'false';
process.env.ENABLE_EXTERNAL_PROVIDERS = 'false';
process.env.ENABLE_OPENPHISH = 'false';
process.env.ENABLE_ML = 'false';
