using System.Runtime.CompilerServices;

namespace UserService.IntegrationTests;

public static class TestInitializer
{
    [ModuleInitializer]
    public static void Initialize()
    {
        Environment.SetEnvironmentVariable("JWT_SECRET", "test-secret-for-integration-tests-minimum-32-chars");
        Environment.SetEnvironmentVariable("USER_DB_CONNECTION_STRING", "Host=localhost;Database=test");
        Environment.SetEnvironmentVariable("REDIS_CONNECTION_STRING", "localhost:6379");
    }
}
