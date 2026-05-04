using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MusicService.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "artists",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    StageName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Bio = table.Column<string>(type: "text", nullable: true),
                    Country = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    ProfileImageUrl = table.Column<string>(type: "text", nullable: true),
                    BannerImageUrl = table.Column<string>(type: "text", nullable: true),
                    Verified = table.Column<bool>(type: "boolean", nullable: false),
                    TotalFollowers = table.Column<long>(type: "bigint", nullable: false),
                    TotalPlays = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_artists", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "genres",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Slug = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    CoverImageUrl = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_genres", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "albums",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ArtistId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    CoverImageUrl = table.Column<string>(type: "text", nullable: true),
                    ReleaseDate = table.Column<DateOnly>(type: "date", nullable: true),
                    AlbumType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    TotalTracks = table.Column<int>(type: "integer", nullable: false),
                    TotalDurationSec = table.Column<int>(type: "integer", nullable: false),
                    IsPublished = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_albums", x => x.Id);
                    table.ForeignKey(
                        name: "FK_albums_artists_ArtistId",
                        column: x => x.ArtistId,
                        principalTable: "artists",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "songs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ArtistId = table.Column<Guid>(type: "uuid", nullable: false),
                    AlbumId = table.Column<Guid>(type: "uuid", nullable: true),
                    Title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    DurationSec = table.Column<int>(type: "integer", nullable: false),
                    TrackNumber = table.Column<int>(type: "integer", nullable: true),
                    S3AudioKey = table.Column<string>(type: "text", nullable: false),
                    S3AudioHlsKey = table.Column<string>(type: "text", nullable: true),
                    S3WaveformKey = table.Column<string>(type: "text", nullable: true),
                    CoverImageUrl = table.Column<string>(type: "text", nullable: true),
                    Lyrics = table.Column<string>(type: "text", nullable: true),
                    Language = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    IsExplicit = table.Column<bool>(type: "boolean", nullable: false),
                    IsPublished = table.Column<bool>(type: "boolean", nullable: false),
                    PlayCount = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_songs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_songs_albums_AlbumId",
                        column: x => x.AlbumId,
                        principalTable: "albums",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_songs_artists_ArtistId",
                        column: x => x.ArtistId,
                        principalTable: "artists",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "song_genres",
                columns: table => new
                {
                    SongId = table.Column<Guid>(type: "uuid", nullable: false),
                    GenreId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_song_genres", x => new { x.SongId, x.GenreId });
                    table.ForeignKey(
                        name: "FK_song_genres_genres_GenreId",
                        column: x => x.GenreId,
                        principalTable: "genres",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_song_genres_songs_SongId",
                        column: x => x.SongId,
                        principalTable: "songs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_albums_AlbumType",
                table: "albums",
                column: "AlbumType");

            migrationBuilder.CreateIndex(
                name: "IX_albums_ArtistId",
                table: "albums",
                column: "ArtistId");

            migrationBuilder.CreateIndex(
                name: "IX_albums_ReleaseDate",
                table: "albums",
                column: "ReleaseDate");

            migrationBuilder.CreateIndex(
                name: "IX_artists_Country",
                table: "artists",
                column: "Country");

            migrationBuilder.CreateIndex(
                name: "IX_artists_TotalPlays",
                table: "artists",
                column: "TotalPlays");

            migrationBuilder.CreateIndex(
                name: "IX_artists_UserId",
                table: "artists",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_genres_Name",
                table: "genres",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_genres_Slug",
                table: "genres",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_song_genres_GenreId",
                table: "song_genres",
                column: "GenreId");

            migrationBuilder.CreateIndex(
                name: "IX_songs_AlbumId",
                table: "songs",
                column: "AlbumId");

            migrationBuilder.CreateIndex(
                name: "IX_songs_ArtistId",
                table: "songs",
                column: "ArtistId");

            migrationBuilder.CreateIndex(
                name: "IX_songs_IsExplicit",
                table: "songs",
                column: "IsExplicit");

            migrationBuilder.CreateIndex(
                name: "IX_songs_PlayCount",
                table: "songs",
                column: "PlayCount");

            migrationBuilder.CreateIndex(
                name: "IX_songs_S3AudioKey",
                table: "songs",
                column: "S3AudioKey",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "song_genres");

            migrationBuilder.DropTable(
                name: "genres");

            migrationBuilder.DropTable(
                name: "songs");

            migrationBuilder.DropTable(
                name: "albums");

            migrationBuilder.DropTable(
                name: "artists");
        }
    }
}
