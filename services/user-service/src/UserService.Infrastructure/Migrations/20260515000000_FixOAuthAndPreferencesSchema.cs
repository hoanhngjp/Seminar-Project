using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UserService.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FixOAuthAndPreferencesSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Make password_hash nullable to support OAuth users
            migrationBuilder.AlterColumn<string>(
                name: "password_hash",
                table: "users",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text");

            // Rename preferred_languages → preferred_artists and widen type to text[]
            // (varchar(10)[] was too short for UUID strings)
            migrationBuilder.RenameColumn(
                name: "preferred_languages",
                table: "user_preferences",
                newName: "preferred_artists");

            migrationBuilder.AlterColumn<string[]>(
                name: "preferred_artists",
                table: "user_preferences",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'",
                oldClrType: typeof(string[]),
                oldType: "varchar(10)[]",
                oldDefaultValueSql: "'{}'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "password_hash",
                table: "users",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AlterColumn<string[]>(
                name: "preferred_artists",
                table: "user_preferences",
                type: "varchar(10)[]",
                nullable: false,
                defaultValueSql: "'{}'",
                oldClrType: typeof(string[]),
                oldType: "text[]",
                oldDefaultValueSql: "'{}'");

            migrationBuilder.RenameColumn(
                name: "preferred_artists",
                table: "user_preferences",
                newName: "preferred_languages");
        }
    }
}
