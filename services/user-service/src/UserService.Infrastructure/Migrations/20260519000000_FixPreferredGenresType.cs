using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UserService.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FixPreferredGenresType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string[]>(
                name: "preferred_genres",
                table: "user_preferences",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'",
                oldClrType: typeof(System.Guid[]),
                oldType: "uuid[]",
                oldDefaultValueSql: "'{}'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<System.Guid[]>(
                name: "preferred_genres",
                table: "user_preferences",
                type: "uuid[]",
                nullable: false,
                defaultValueSql: "'{}'",
                oldClrType: typeof(string[]),
                oldType: "text[]",
                oldDefaultValueSql: "'{}'");
        }
    }
}
