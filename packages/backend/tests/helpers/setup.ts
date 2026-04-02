// Test setup — runs before each test file
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://finplan:finplan@localhost:5432/finplan_test';
process.env.JWT_SECRET = 'test-jwt-secret-not-for-production';
