import { prisma } from "@/lib/db";
import { normalizeSeasonYear, sanitizeTeamNumber } from "@/lib/part-number";

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
    ])
      .then(async () => {
        await prisma.$executeRawUnsafe(`
          INSERT INTO app_robot_numbers (team_number, season_year, robot_number, created_at)
          SELECT team_number, RIGHT(regexp_replace(season_year, '\\D', '', 'g'), 2), robot_number, MIN(created_at)
          FROM app_robot_numbers
          GROUP BY team_number, RIGHT(regexp_replace(season_year, '\\D', '', 'g'), 2), robot_number
          ON CONFLICT (team_number, season_year, robot_number) DO NOTHING
        `);
        await prisma.$executeRawUnsafe(`
          DELETE FROM app_robot_numbers
          WHERE length(regexp_replace(season_year, '\\D', '', 'g')) > 2
        `);
        await prisma.$executeRawUnsafe(`
          INSERT INTO app_subsystems (team_number, season_year, robot_number, subsystem_number, label, created_at)
          SELECT
            team_number,
            RIGHT(regexp_replace(season_year, '\\D', '', 'g'), 2),
            robot_number,
            LEFT(regexp_replace(subsystem_number, '\\D', '', 'g'), 1),
            label,
            MIN(created_at)
          FROM app_subsystems
          WHERE regexp_replace(subsystem_number, '\\D', '', 'g') <> ''
          GROUP BY
            team_number,
            RIGHT(regexp_replace(season_year, '\\D', '', 'g'), 2),
            robot_number,
            LEFT(regexp_replace(subsystem_number, '\\D', '', 'g'), 1),
            label
          ON CONFLICT (team_number, season_year, robot_number, subsystem_number) DO NOTHING
        `);
        await prisma.$executeRawUnsafe(`
          DELETE FROM app_subsystems
          WHERE length(regexp_replace(season_year, '\\D', '', 'g')) > 2
             OR regexp_replace(subsystem_number, '\\D', '', 'g') = ''
             OR length(regexp_replace(subsystem_number, '\\D', '', 'g')) > 1
        `);
        await prisma.$executeRawUnsafe(`
          UPDATE "Project"
          SET season = RIGHT(regexp_replace(season, '\\D', '', 'g'), 2)
          WHERE length(regexp_replace(season, '\\D', '', 'g')) > 2
        `);
      })
      .then(() => undefined);
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
  for (const row of robotRows) seasonSet.add(normalizeSeasonYear(row.season_year));
  for (const row of subsystemRows) seasonSet.add(normalizeSeasonYear(row.season_year));
  const seasonYears = Array.from(seasonSet).sort((a, b) => a.localeCompare(b));
  const normalizedRobotRows = new Map<string, { teamNumber: string; seasonYear: string; robotNumber: string }>();
  for (const row of robotRows) {
    const normalized = {
      teamNumber: row.team_number,
      seasonYear: normalizeSeasonYear(row.season_year),
      robotNumber: row.robot_number
    };
    if (!normalized.teamNumber || !normalized.seasonYear || !normalized.robotNumber) continue;
    normalizedRobotRows.set(
      `${normalized.teamNumber}:${normalized.seasonYear}:${normalized.robotNumber}`,
      normalized
    );
  }
  const normalizedSubsystemRows = new Map<
    string,
    { teamNumber: string; seasonYear: string; robotNumber: string; subsystemNumber: string; label: string | null }
  >();
  for (const row of subsystemRows) {
    const normalizedSubsystem = row.subsystem_number.replace(/\D/g, "").slice(0, 1);
    const normalized = {
      teamNumber: row.team_number,
      seasonYear: normalizeSeasonYear(row.season_year),
      robotNumber: row.robot_number,
      subsystemNumber: normalizedSubsystem,
      label: row.label
    };
    if (!normalized.teamNumber || !normalized.seasonYear || !normalized.robotNumber || !normalized.subsystemNumber) continue;
    normalizedSubsystemRows.set(
      `${normalized.teamNumber}:${normalized.seasonYear}:${normalized.robotNumber}:${normalized.subsystemNumber}`,
      normalized
    );
  }

  return {
    teamNumbers: teamRows.map((row) => row.team_number),
    seasonYears,
    robotNumbers: Array.from(normalizedRobotRows.values()),
    subsystems: Array.from(normalizedSubsystemRows.values())
  };
}

export async function addTeamNumber(teamNumber: string): Promise<void> {
  await ensureTables();
  const value = sanitizeTeamNumber(teamNumber);
  if (!value) return;
  await prisma.$executeRawUnsafe(
    "INSERT INTO app_team_numbers (team_number) VALUES ($1) ON CONFLICT (team_number) DO NOTHING",
    value
  );
}

export async function addRobotNumber(teamNumber: string, seasonYear: string, robotNumber: string): Promise<void> {
  await ensureTables();
  const team = sanitizeTeamNumber(teamNumber);
  const year = normalizeSeasonYear(seasonYear);
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
  const team = sanitizeTeamNumber(teamNumber);
  const year = normalizeSeasonYear(seasonYear);
  const robot = robotNumber.replace(/\D/g, "").slice(0, 2);
  const subsystem = subsystemNumber.replace(/\D/g, "").slice(0, 1);
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
