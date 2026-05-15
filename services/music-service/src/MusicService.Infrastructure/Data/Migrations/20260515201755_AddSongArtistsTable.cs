using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MusicService.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSongArtistsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "song_artists",
                columns: table => new
                {
                    SongId = table.Column<Guid>(type: "uuid", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    ArtistId = table.Column<Guid>(type: "uuid", nullable: true),
                    DisplayName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    Role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "primary")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_song_artists", x => new { x.SongId, x.DisplayOrder });
                    table.ForeignKey(
                        name: "FK_song_artists_artists_ArtistId",
                        column: x => x.ArtistId,
                        principalTable: "artists",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_song_artists_songs_SongId",
                        column: x => x.SongId,
                        principalTable: "songs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_song_artists_ArtistId",
                table: "song_artists",
                column: "ArtistId");

            migrationBuilder.CreateIndex(
                name: "IX_song_artists_SongId",
                table: "song_artists",
                column: "SongId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "song_artists");
        }
    }
}
