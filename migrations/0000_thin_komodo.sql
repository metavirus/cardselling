CREATE TABLE "application_info" (
	"id" uuid PRIMARY KEY NOT NULL,
	"application" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
INSERT INTO "application_info" ("id", "application")
VALUES ('36cf7b0d-0b12-4ae1-bfab-883f9ed12e8c', 'cardselling');
