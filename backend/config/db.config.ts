export default () => ({
    databaseUrl: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/meetrobot',
});
