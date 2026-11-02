CREATE TABLE "Game" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "genre" TEXT NOT NULL,
  "platforms" TEXT NOT NULL DEFAULT 'PC',
  "releaseYear" INTEGER,
  "coverUrl" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Game_slug_key" ON "Game"("slug");
CREATE UNIQUE INDEX "Game_title_key" ON "Game"("title");
CREATE INDEX "Game_title_idx" ON "Game"("title");
CREATE INDEX "Game_genre_idx" ON "Game"("genre");

CREATE TABLE "UserGame" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "gameId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserGame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UserGame_userId_gameId_key" ON "UserGame"("userId", "gameId");
CREATE INDEX "UserGame_userId_status_updatedAt_idx" ON "UserGame"("userId", "status", "updatedAt");
CREATE INDEX "UserGame_gameId_status_idx" ON "UserGame"("gameId", "status");

INSERT INTO "Game" ("id","slug","title","genre","platforms","releaseYear","coverUrl","createdAt") VALUES
('game_cyberpunk_2077','cyberpunk-2077','Cyberpunk 2077','RPG · Open world','PC, PlayStation, Xbox',2020,'https://cdn.akamai.steamstatic.com/steam/apps/1091500/header.jpg',CURRENT_TIMESTAMP),
('game_the_witcher_3','the-witcher-3','The Witcher 3: Wild Hunt','RPG · Open world','PC, PlayStation, Xbox, Switch',2015,'https://cdn.akamai.steamstatic.com/steam/apps/292030/header.jpg',CURRENT_TIMESTAMP),
('game_red_dead_redemption_2','red-dead-redemption-2','Red Dead Redemption 2','Action · Open world','PC, PlayStation, Xbox',2019,'https://cdn.akamai.steamstatic.com/steam/apps/1174180/header.jpg',CURRENT_TIMESTAMP),
('game_elden_ring','elden-ring','Elden Ring','Action RPG','PC, PlayStation, Xbox',2022,'https://cdn.akamai.steamstatic.com/steam/apps/1245620/header.jpg',CURRENT_TIMESTAMP),
('game_baldurs_gate_3','baldurs-gate-3','Baldur''s Gate 3','RPG · Turn-based','PC, PlayStation, Xbox',2023,'https://cdn.akamai.steamstatic.com/steam/apps/1086940/header.jpg',CURRENT_TIMESTAMP),
('game_doom_eternal','doom-eternal','DOOM Eternal','FPS · Action','PC, PlayStation, Xbox, Switch',2020,'https://cdn.akamai.steamstatic.com/steam/apps/782330/header.jpg',CURRENT_TIMESTAMP),
('game_forza_horizon_5','forza-horizon-5','Forza Horizon 5','Racing · Open world','PC, Xbox, PlayStation',2021,'https://cdn.akamai.steamstatic.com/steam/apps/1551360/header.jpg',CURRENT_TIMESTAMP),
('game_grand_theft_auto_v','grand-theft-auto-v','Grand Theft Auto V','Action · Open world','PC, PlayStation, Xbox',2015,'https://cdn.akamai.steamstatic.com/steam/apps/271590/header.jpg',CURRENT_TIMESTAMP),
('game_hades','hades','Hades','Roguelike · Action','PC, PlayStation, Xbox, Switch',2020,'https://cdn.akamai.steamstatic.com/steam/apps/1145360/header.jpg',CURRENT_TIMESTAMP),
('game_hollow_knight','hollow-knight','Hollow Knight','Metroidvania','PC, PlayStation, Xbox, Switch',2017,'https://cdn.akamai.steamstatic.com/steam/apps/367520/header.jpg',CURRENT_TIMESTAMP),
('game_stardew_valley','stardew-valley','Stardew Valley','Simulator · RPG','PC, PlayStation, Xbox, Switch, Mobile',2016,'https://cdn.akamai.steamstatic.com/steam/apps/413150/header.jpg',CURRENT_TIMESTAMP),
('game_portal_2','portal-2','Portal 2','Puzzle · Adventure','PC, PlayStation, Xbox',2011,'https://cdn.akamai.steamstatic.com/steam/apps/620/header.jpg',CURRENT_TIMESTAMP),
('game_terraria','terraria','Terraria','Sandbox · Adventure','PC, PlayStation, Xbox, Switch, Mobile',2011,'https://cdn.akamai.steamstatic.com/steam/apps/105600/header.jpg',CURRENT_TIMESTAMP),
('game_no_mans_sky','no-mans-sky','No Man''s Sky','Adventure · Survival','PC, PlayStation, Xbox, Switch',2016,'https://cdn.akamai.steamstatic.com/steam/apps/275850/header.jpg',CURRENT_TIMESTAMP),
('game_sekiro','sekiro','Sekiro: Shadows Die Twice','Action · Adventure','PC, PlayStation, Xbox',2019,'https://cdn.akamai.steamstatic.com/steam/apps/814380/header.jpg',CURRENT_TIMESTAMP),
('game_metro_exodus','metro-exodus','Metro Exodus','FPS · Story','PC, PlayStation, Xbox',2019,'https://cdn.akamai.steamstatic.com/steam/apps/412020/header.jpg',CURRENT_TIMESTAMP),
('game_resident_evil_4','resident-evil-4','Resident Evil 4','Horror · Action','PC, PlayStation, Xbox',2023,'https://cdn.akamai.steamstatic.com/steam/apps/2050650/header.jpg',CURRENT_TIMESTAMP),
('game_the_elder_scrolls_v_skyrim','the-elder-scrolls-v-skyrim','The Elder Scrolls V: Skyrim','RPG · Open world','PC, PlayStation, Xbox, Switch',2011,'https://cdn.akamai.steamstatic.com/steam/apps/489830/header.jpg',CURRENT_TIMESTAMP),
('game_counter_strike_2','counter-strike-2','Counter-Strike 2','FPS · Competitive','PC',2023,'https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg',CURRENT_TIMESTAMP),
('game_left_4_dead_2','left-4-dead-2','Left 4 Dead 2','FPS · Co-op','PC, Xbox',2009,'https://cdn.akamai.steamstatic.com/steam/apps/550/header.jpg',CURRENT_TIMESTAMP),
('game_dishonored_2','dishonored-2','Dishonored 2','Action · Stealth','PC, PlayStation, Xbox',2016,'https://cdn.akamai.steamstatic.com/steam/apps/403640/header.jpg',CURRENT_TIMESTAMP),
('game_mass_effect_legendary_edition','mass-effect-legendary-edition','Mass Effect Legendary Edition','RPG · Sci-fi','PC, PlayStation, Xbox',2021,'https://cdn.akamai.steamstatic.com/steam/apps/1328670/header.jpg',CURRENT_TIMESTAMP);
