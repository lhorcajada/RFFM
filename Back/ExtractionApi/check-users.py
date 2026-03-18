import psycopg2

conn = psycopg2.connect(
    host="localhost", port=5433,
    dbname="rffm_coaches",
    user="rffm_coaches",
    password="rffm_coaches_dev_2024"
)
cur = conn.cursor()

print("=== AspNetUsers en PostgreSQL ===")
cur.execute('SELECT "Id", "UserName", "Email", "EmailConfirmed", "NormalizedUserName" FROM public."AspNetUsers"')
for row in cur.fetchall():
    print(f"  Id:       {row[0]}")
    print(f"  UserName: {row[1]}")
    print(f"  Email:    {row[2]}")
    print(f"  Confirmed:{row[3]}")
    print(f"  Normalized:{row[4]}")
    print()

print("=== AspNetRoles en PostgreSQL ===")
cur.execute('SELECT "Id", "Name", "NormalizedName" FROM public."AspNetRoles"')
for row in cur.fetchall():
    print(f"  {row[1]} ({row[2]})")

print()
print("=== AspNetUserRoles ===")
cur.execute('SELECT "UserId", "RoleId" FROM public."AspNetUserRoles"')
for row in cur.fetchall():
    print(f"  UserId:{row[0]} -> RoleId:{row[1]}")

cur.close()
conn.close()
