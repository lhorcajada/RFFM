-- ============================================================
-- Script de consolidación de BD local para usar una sola conexión
-- Ejecutar en la BD rffm_coaches (contenedor rffm-coaches-db)
-- ============================================================

-- PASO 1: Crear esquema identity y mover tablas de Identity de public a identity
CREATE SCHEMA IF NOT EXISTS identity;

DO $$ 
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY[
        'AspNetRoles',
        'AspNetRoleClaims',
        'AspNetUsers',
        'AspNetUserClaims',
        'AspNetUserLogins',
        'AspNetUserRoles',
        'AspNetUserTokens'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = t
        ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'identity' AND table_name = t
        ) THEN
            EXECUTE format('ALTER TABLE public.%I SET SCHEMA identity;', t);
            RAISE NOTICE 'Moved table % to identity schema', t;
        ELSE
            RAISE NOTICE 'Table % already in identity schema or not found in public', t;
        END IF;
    END LOOP;
END $$;

-- Crear tabla de migraciones en esquema identity
CREATE TABLE IF NOT EXISTS identity."__EFMigrationsHistory" (
    "MigrationId"    varchar(150) NOT NULL,
    "ProductVersion" varchar(32)  NOT NULL,
    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
);

-- Registrar migración inicial de Identity (si no existe)
INSERT INTO identity."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
SELECT '20260316173031_InitialCreate', '9.0.6'
WHERE NOT EXISTS (
    SELECT 1 FROM identity."__EFMigrationsHistory" WHERE "MigrationId" = '20260316173031_InitialCreate'
);

-- Registrar migración de movimiento de esquema (si no existe)
INSERT INTO identity."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
SELECT '20260503000000_MoveIdentityToSchema', '9.0.6'
WHERE NOT EXISTS (
    SELECT 1 FROM identity."__EFMigrationsHistory" WHERE "MigrationId" = '20260503000000_MoveIdentityToSchema'
);

-- También mover la __EFMigrationsHistory de public a public (ya está ahí, no mover)
-- pero crear la del esquema app si no existe
CREATE TABLE IF NOT EXISTS app."__EFMigrationsHistory" (
    "MigrationId"    varchar(150) NOT NULL,
    "ProductVersion" varchar(32)  NOT NULL,
    CONSTRAINT "PK___EFMigrationsHistory_app" PRIMARY KEY ("MigrationId")
);

-- Copiar las migraciones de app desde la tabla de public
INSERT INTO app."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
SELECT "MigrationId", "ProductVersion"
FROM public."__EFMigrationsHistory"
WHERE "MigrationId" NOT IN ('20260316173031_InitialCreate')  -- la de identity no va aquí
ON CONFLICT DO NOTHING;

-- Registrar las migraciones que EF espera pero no estaban en la tabla de public
-- (las que se crearon para la unificación con supabase)
INSERT INTO app."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES 
    ('20260401163621_AddSubPrinciplesTables', '9.0.6'),
    ('20260401163622_AddMissingAppTables', '9.0.6')
ON CONFLICT DO NOTHING;

-- PASO 2: Crear esquema federation
CREATE SCHEMA IF NOT EXISTS federation;

-- Crear tabla FederationSettings en esquema federation (si no existe)
CREATE TABLE IF NOT EXISTS federation."FederationSettings" (
    "Id"          character varying(36)  NOT NULL,
    "Name"        character varying(200) NOT NULL,
    "Value"       text                   NOT NULL,
    "IsPrimary"   boolean                NOT NULL DEFAULT false,
    CONSTRAINT "PK_FederationSettings" PRIMARY KEY ("Id")
);

-- Crear tabla de migraciones en esquema federation
CREATE TABLE IF NOT EXISTS federation."__EFMigrationsHistory" (
    "MigrationId"    varchar(150) NOT NULL,
    "ProductVersion" varchar(32)  NOT NULL,
    CONSTRAINT "PK___EFMigrationsHistory_fed" PRIMARY KEY ("MigrationId")
);

-- Registrar migraciones de federation
INSERT INTO federation."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES 
    ('20260306132638_InitialFederation', '9.0.6'),
    ('20260503000001_MoveFederationToSchema', '9.0.6')
ON CONFLICT DO NOTHING;

-- Verificación final
SELECT 'identity tables:' as info;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'identity' ORDER BY table_name;

SELECT 'federation tables:' as info;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'federation' ORDER BY table_name;

SELECT 'app migrations:' as info;
SELECT "MigrationId" FROM app."__EFMigrationsHistory" ORDER BY "MigrationId";

SELECT 'identity migrations:' as info;
SELECT "MigrationId" FROM identity."__EFMigrationsHistory" ORDER BY "MigrationId";

SELECT 'federation migrations:' as info;
SELECT "MigrationId" FROM federation."__EFMigrationsHistory" ORDER BY "MigrationId";
