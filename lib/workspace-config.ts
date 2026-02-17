import { prisma } from "@/lib/db";

let ensurePromise: Promise<void> | null = null;

export type WorkspaceOptions = {
  teamNumbers: string[];
  seasonYears: string[];
  robotNumbers: Array<{ teamNumber: string; seasonYear: string; robotNumber: string }>;
  subsystems: Array<{
    teamNumber: string;
    seasonYear: string;
    robotNumber: string;
    subsystemNumber: string;
    label: string | null;
  }>;
};

async function ensureTables(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = Promise.all([
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS app_team_numbers (
          team_number TEXT PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `),
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS app_robot_numbers (
          team_number TEXT NOT NULL,
          season_year TEXT NOT NULL,
          robot_number TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (team_number, season_year, robot_number)
        )
      `),
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS app_subsystems (
          team_number TEXT NOT NULL,
          season_year TEXT NOT NULL,
          robot_number TEXT NOT NULL,
          subsystem_number TEXT NOT NULL,
          label TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (team_number, season_year, robot_number, subsystem_number)
        )
      `)
    ]).then(() => undefined);
  }
  return ensurePromise;
}

export async function listWorkspaceOptions(): Promise<WorkspaceOptions> {
  await ensureTables();
  const [teamRows, robotRows, subsystemRows] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ team_number: string }>>(
      "SELECT team_number FROM app_team_numbers ORDER BY team_number ASC"
    ),
    prisma.$queryRawUnsafe<Array<{ team_number: string; season_year: string; robot_number: string }>>(
      "SELECT team_number, season_year, robot_number FROM app_robot_numbers ORDER BY team_number, season_year, robot_number"
    ),
    prisma.$queryRawUnsafe<
      Array<{
        team_number: string;
        season_year: string;
        robot_number: string;
        subsystem_number: string;
        label: string | null;
      }>
    >(
      "SELECT team_number, season_year, robot_number, subsystem_number, label FROM app_subsystems ORDER BY team_number, season_year, robot_number, subsystem_number"
    )
  ]);

  const seasonSet = new Set<string>();
  for (const row of robotRows) seasonSet.add(row.season_year);
  for (const row of subsystemRows) seasonSet.add(row.season_year);
  const seasonYears = Array.from(seasonSet).sort((a, b) => a.localeCompare(b));

  return {
    teamNumbers: teamRows.map((row) => row.team_number),
    seasonYears,
    robotNumbers: robotRows.map((row) => ({
      teamNumber: row.team_number,
      seasonYear: row.season_year,
      robotNumber: row.robot_number
    })),
    subsystems: subsystemRows.map((row) => ({
      teamNumber: row.team_number,
      seasonYear: row.season_year,
      robotNumber: row.robot_number,
      subsystemNumber: row.subsystem_number,
      label: row.label
    }))
  };
}

export async function addTeamNumber(teamNumber: string): Promise<void> {
  await ensureTables();
  const value = teamNumber.replace(/\D/g, "").slice(0, 4);
  if (!value) return;
  await prisma.$executeRawUnsafe(
    "INSERT INTO app_team_numbers (team_number) VALUES ($1) ON CONFLICT (team_number) DO NOTHING",
    value
  );
}

export async function addRobotNumber(teamNumber: string, seasonYear: string, robotNumber: string): Promise<void> {
  await ensureTables();
  const team = teamNumber.replace(/\D/g, "").slice(0, 4);
  const year = seasonYear.replace(/\D/g, "").slice(0, 4);
  const robot = robotNumber.replace(/\D/g, "").slice(0, 2);
  if (!team || !year || !robot) return;
  await prisma.$executeRawUnsafe(
    "INSERT INTO app_robot_numbers (team_number, season_year, robot_number) VALUES ($1, $2, $3) ON CONFLICT (team_number, season_year, robot_number) DO NOTHING",
    team,
    year,
    robot
  );
}

export async function addSubsystem(
  teamNumber: string,
  seasonYear: string,
  robotNumber: string,
  subsystemNumber: string,
  label?: string
): Promise<void> {
  await ensureTables();
  const team = teamNumber.replace(/\D/g, "").slice(0, 4);
  const year = seasonYear.replace(/\D/g, "").slice(0, 4);
  const robot = robotNumber.replace(/\D/g, "").slice(0, 2);
  const subsystem = subsystemNumber.replace(/\D/g, "").slice(0, 2);
  if (!team || !year || !robot || !subsystem) return;
  await prisma.$executeRawUnsafe(
    "INSERT INTO app_subsystems (team_number, season_year, robot_number, subsystem_number, label) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (team_number, season_year, robot_number, subsystem_number) DO UPDATE SET label = COALESCE(EXCLUDED.label, app_subsystems.label)",
    team,
    year,
    robot,
    subsystem,
    label?.trim() || null
  );
}

