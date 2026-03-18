"""
migrate-data.py
Migra datos de SQL Server (FutbolBase) -> PostgreSQL (rffm_coaches)
"""
import pyodbc
import psycopg2
import psycopg2.extras
import decimal
import struct
from datetime import datetime, timezone, timedelta

# Converter para datetimeoffset (ODBC type -155) -> string ISO
def handle_datetimeoffset(raw):
    tup = struct.unpack("<6hI2h", raw)
    dt = datetime(tup[0], tup[1], tup[2], tup[3], tup[4], tup[5], tup[6] // 1000,
                  tzinfo=timezone(timedelta(hours=tup[7], minutes=tup[8])))
    return dt.isoformat()

# --- Conexiones ---
sql_conn = pyodbc.connect(
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=127.0.0.1,1433;"
    "DATABASE=FutbolBase;"
    "UID=sa;"
    "PWD=PassLogo33.#;"
    "TrustServerCertificate=yes"
)
sql_conn.autocommit = True
sql_conn.add_output_converter(-155, handle_datetimeoffset)  # datetimeoffset

pg_conn = psycopg2.connect(
    host="localhost", port=5433,
    dbname="rffm_coaches",
    user="rffm_coaches",
    password="rffm_coaches_dev_2024"
)
pg_conn.autocommit = False

sql_cur = sql_conn.cursor()
pg_cur  = pg_conn.cursor()

# --- Tablas app en orden de dependencia ---
APP_TABLES = [
    "Countries", "PaymentPlans", "AssistanceTypes", "ConvocationStatuses",
    "SportEventTypes", "PlayTypes", "DemarcationMaster", "TechnicalTypes",
    "TacticalGoals", "TechnicalGoals", "Materials", "PointsTypes", "ExcuseTypes",
    "Categories", "Leagues", "Clubs", "UserClubs", "Memberships", "Teams",
    "Players", "Rivals", "TeamPlayers", "TeamPlayerPhysicalAttributes",
    "TeamPlayerContactInfos", "TeamPlayerDemarcations", "TeamPlayerDorsals",
    "SportEvents", "Convocations", "Seasons", "Subscriptions", "SessionTrainings",
]

# Tablas Identity: (sql_schema, pg_schema, name)
IDENTITY_TABLES = [
    ("dbo", "public", "AspNetRoles"),
    ("dbo", "public", "AspNetUsers"),
    ("dbo", "public", "AspNetUserRoles"),
    ("dbo", "public", "AspNetRoleClaims"),
]


def get_columns(schema, table):
    sql_cur.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
        "WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY ORDINAL_POSITION",
        schema, table
    )
    return [row[0] for row in sql_cur.fetchall()]


def migrate_table(sql_schema, pg_schema, table):
    cols = get_columns(sql_schema, table)
    if not cols:
        print(f"  ! {table}: sin columnas, omitida")
        return 0

    # Leer de SQL Server
    sql_cur.execute(f"SELECT {', '.join(f'[{c}]' for c in cols)} FROM [{sql_schema}].[{table}]")
    rows = sql_cur.fetchall()
    if not rows:
        print(f"  - {pg_schema}.{table}: vacia")
        return 0

    # Convertir tipos no compatibles (Decimal -> float para psycopg2)
    def convert_row(row):
        return tuple(
            float(v) if isinstance(v, decimal.Decimal) else v
            for v in row
        )

    rows = [convert_row(r) for r in rows]

    # Escribir en PostgreSQL con ON CONFLICT DO NOTHING
    pg_cols = ", ".join(f'"{c}"' for c in cols)
    placeholders = ", ".join(["%s"] * len(cols))
    sql = f'INSERT INTO {pg_schema}."{table}" ({pg_cols}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'

    try:
        pg_cur.executemany(sql, rows)
        pg_conn.commit()
        print(f"  + {pg_schema}.{table}: {len(rows)} filas")
        return len(rows)
    except Exception as e:
        pg_conn.rollback()
        print(f"  ERROR en {table}: {e}")
        return 0


# --- Deshabilitar FK checks durante la importacion ---
pg_cur.execute("SET session_replication_role = replica")
pg_conn.commit()

print()
print("=== Migracion SQL Server -> PostgreSQL ===")
print()

total = 0

print("-- Tablas app --")
for t in APP_TABLES:
    total += migrate_table("app", "app", t)

print()
print("-- Tablas Identity --")
for sql_schema, pg_schema, t in IDENTITY_TABLES:
    total += migrate_table(sql_schema, pg_schema, t)

# Re-habilitar FK checks
pg_cur.execute("SET session_replication_role = DEFAULT")
pg_conn.commit()

print()
print(f"=== Total migrado: {total} filas ===")

# Verificar
print()
print("-- Filas en PostgreSQL --")
pg_cur.execute(
    "SELECT schemaname||'.'||tablename, n_live_tup "
    "FROM pg_stat_user_tables WHERE n_live_tup > 0 ORDER BY n_live_tup DESC"
)
for row in pg_cur.fetchall():
    print(f"  {row[0]}: {row[1]}")

sql_cur.close()
sql_conn.close()
pg_cur.close()
pg_conn.close()
