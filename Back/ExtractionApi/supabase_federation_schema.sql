CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL,
    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
);

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260306132638_InitialFederation') THEN
    CREATE TABLE "FederationSettings" (
        "Id" text NOT NULL,
        "UserId" character varying(450) NOT NULL,
        "CompetitionId" character varying(100),
        "CompetitionName" character varying(256),
        "GroupId" character varying(100),
        "GroupName" character varying(256),
        "TeamId" character varying(100),
        "TeamName" character varying(256),
        "CreatedAt" bigint NOT NULL,
        "IsPrimary" boolean NOT NULL DEFAULT FALSE,
        CONSTRAINT "PK_FederationSettings" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260306132638_InitialFederation') THEN
    CREATE INDEX "IX_FederationSettings_UserId" ON "FederationSettings" ("UserId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260306132638_InitialFederation') THEN
    CREATE INDEX "IX_FederationSettings_UserId_IsPrimary" ON "FederationSettings" ("UserId", "IsPrimary");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260306132638_InitialFederation') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260306132638_InitialFederation', '9.0.6');
    END IF;
END $EF$;
COMMIT;

-- Datos migrados desde SQL Server
INSERT INTO "FederationSettings" ("Id", "UserId", "CompetitionId", "CompetitionName", "GroupId", "GroupName", "TeamId", "TeamName", "CreatedAt", "IsPrimary") VALUES
('525d30d4-c3a4-40a1-afdd-d2be21a77f7a','107049b2-60a4-425a-9d1b-c72067003f58','25255269','SEGUNDA INFANTIL','25255283','Grupo 14','13553720','FEPE GETAFE III ''E''',1765728349060,false),
('3e6e5b9d-4ca3-4386-b55f-cbc1ba49aca4','107049b2-60a4-425a-9d1b-c72067003f58','24897923','SEGUNDA JUVENIL','24897933','Grupo 12','17133913','A.D. JUVENTUD CANARIO ''B''',1765728366269,true),
('c9b9813e-7b7c-4d6f-bbad-e5a5b8576a1b','107049b2-60a4-425a-9d1b-c72067003f58','25255269','SEGUNDA INFANTIL','25255303','Grupo 35','15290721','A.D. ALHONDIGA ''C''',1765728381934,false),
('d36d5f89-6140-4b81-9f57-2be70addd111','ab3434c4-a6e3-4d80-a5ba-d6ae3fb83d8d','25255269','SEGUNDA INFANTIL','25255283','Grupo 14','13553720','FEPE GETAFE III ''E''',1765824066307,true),
('f80eed19-c756-4022-91b2-49f51476e80a','291a22d5-4024-447a-b799-5b69bf64999c','25255269','SEGUNDA INFANTIL','25255283','Grupo 14','13553720','FEPE GETAFE III ''E''',1765825734126,true),
('8e4b1c71-17a8-4b10-af5f-5bc2614c3e67','ab3434c4-a6e3-4d80-a5ba-d6ae3fb83d8d','24897923','SEGUNDA JUVENIL','24897933','Grupo 12','17133913','A.D. JUVENTUD CANARIO ''B''',1766256147500,false),
('8d337659-73b5-4e81-bd4c-01f01fed2b81','ab3434c4-a6e3-4d80-a5ba-d6ae3fb83d8d','24897923','SEGUNDA JUVENIL','24897933','Grupo 12','17139069','C.D.E. GETAFE ATLETICO ''A''',1768045481996,false),
('bcf588e7-d9de-43b6-b09f-c18902fd6a9d','ab3434c4-a6e3-4d80-a5ba-d6ae3fb83d8d','25255269','SEGUNDA INFANTIL','25255303','Grupo 35','15290721','A.D. ALHONDIGA ''C''',1768051165144,false)
ON CONFLICT ("Id") DO NOTHING;
