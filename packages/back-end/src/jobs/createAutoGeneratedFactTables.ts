import Agenda, { Job } from "agenda";
import { FactTableInterface } from "@back-end/types/fact-table";
import { getDataSourceById } from "../models/DataSourceModel";
import { getSourceIntegrationObject } from "../services/datasource";
import { logger } from "../util/logger";
import { insertAudit } from "../models/AuditModel";
import { auditDetailsCreate } from "../services/audit";
import { ExpandedMember } from "../../types/organization";
import { AuditUserLoggedIn } from "../../types/audit";
import { getContextForAgendaJobByOrgId } from "../services/organizations";
import { trackJob } from "../services/otel";
import { createFactTables } from "../models/FactTableModel";

const CREATE_AUTOGENERATED_FACT_TABLES_JOB_NAME =
  "createAutoGeneratedFactTables";

type CreateAutoGeneratedFactTablesJob = Job<{
  organizationId: string;
  datasourceId: string;
  factTablesToCreate: Omit<
    FactTableInterface,
    "id" | "dateCreated" | "dateUpdated"
  >[];
  user: Omit<
    ExpandedMember,
    "role" | "verified" | "limitAccessByEnvironment" | "environments"
  >;
}>;

const createAutoGeneratedFactTables = trackJob(
  CREATE_AUTOGENERATED_FACT_TABLES_JOB_NAME,
  async (job: CreateAutoGeneratedFactTablesJob) => {
    const {
      datasourceId,
      organizationId,
      factTablesToCreate,
      user,
    } = job.attrs.data;

    const context = await getContextForAgendaJobByOrgId(organizationId);

    try {
      const datasource = await getDataSourceById(context, datasourceId);

      if (!datasource) throw new Error("No datasource");

      const schemaFormat = datasource.settings.schemaFormat || "custom";

      if (schemaFormat === "custom")
        throw new Error(
          `Unable to automatically generate fact tables for a custom schema format.`
        );

      const integration = getSourceIntegrationObject(context, datasource);

      if (!integration.getSourceProperties().supportsAutoGeneratedFactTables)
        throw new Error(
          "Auto generated fact tables not supported for this data source"
        );

      const newFactTables = await createFactTables(factTablesToCreate);

      for (const factTable of newFactTables) {
        await insertAudit({
          event: "factTable.autocreate",
          entity: {
            object: "factTable",
            id: factTable.id,
          },
          organization: organizationId,
          dateCreated: factTable.dateCreated || new Date(),
          details: auditDetailsCreate(factTable),
          user,
        });
      }
    } catch (e) {
      logger.error(
        e,
        "Failed to generate automatic fact tables. Reason: " + e.message
      );
    }
  }
);

let agenda: Agenda;
export default function (ag: Agenda) {
  agenda = ag;
  agenda.define(
    CREATE_AUTOGENERATED_FACT_TABLES_JOB_NAME,
    createAutoGeneratedFactTables
  );
}

export async function queueCreateAutoGeneratedFactTables(
  datasourceId: string,
  organizationId: string,
  factTablesToCreate: Omit<
    FactTableInterface,
    "id" | "dateCreated" | "dateUpdated"
  >[],
  user: AuditUserLoggedIn
) {
  if (
    !datasourceId ||
    !organizationId ||
    !factTablesToCreate ||
    !factTablesToCreate.length ||
    !user
  )
    return;

  const job = agenda.create(CREATE_AUTOGENERATED_FACT_TABLES_JOB_NAME, {
    organizationId,
    datasourceId,
    factTablesToCreate,
    user,
  }) as CreateAutoGeneratedFactTablesJob;
  job.unique({ datasourceId, organizationId, factTablesToCreate });
  job.schedule(new Date());
  await job.save();
}
