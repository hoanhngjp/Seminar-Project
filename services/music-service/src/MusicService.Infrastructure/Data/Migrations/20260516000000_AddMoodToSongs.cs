using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MusicService.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMoodToSongs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Mood",
                table: "songs",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Mood",
                table: "songs");
        }
    }
}
