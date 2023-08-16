import { ExperimentInterfaceStringDates } from "back-end/types/experiment";
import { getScopedSettings } from "shared/settings";
import { useMemo, useState } from "react";
import {
  MetricRegressionAdjustmentStatus,
  ReportInterface,
} from "back-end/types/report";
import { DEFAULT_REGRESSION_ADJUSTMENT_ENABLED } from "shared/constants";
import { MetricInterface } from "back-end/types/metric";
import uniq from "lodash/uniq";
import { VisualChangesetInterface } from "back-end/types/visual-changeset";
import { SDKConnectionInterface } from "back-end/types/sdk-connection";
import Link from "next/link";
import { useRouter } from "next/router";
import { useDefinitions } from "@/services/DefinitionsContext";
import { useUser } from "@/services/UserContext";
import useOrgSettings from "@/hooks/useOrgSettings";
import { getRegressionAdjustmentsForMetric } from "@/services/experiments";
import { useAuth } from "@/services/auth";
import Button from "@/components/Button";
import { GBAddCircle } from "@/components/Icons";
import Results from "../Results";
import { StartExperimentBanner } from "../StartExperimentBanner";
import AnalysisForm from "../AnalysisForm";
import ExperimentReportsList from "../ExperimentReportsList";
import { useSnapshot } from "../SnapshotProvider";
import AnalysisSettingsSummary from "./AnalysisSettingsSummary";
import { ExperimentTab, LinkedFeature } from ".";

export interface Props {
  experiment: ExperimentInterfaceStringDates;
  mutate: () => void;
  editMetrics?: (() => void) | null;
  editResult?: (() => void) | null;
  newPhase?: (() => void) | null;
  editPhases?: (() => void) | null;
  visualChangesets: VisualChangesetInterface[];
  editTargeting?: (() => void) | null;
  linkedFeatures: LinkedFeature[];
  setTab: (tab: ExperimentTab) => void;
  connections: SDKConnectionInterface[];
}

export default function ResultsTab({
  experiment,
  mutate,
  editMetrics,
  editResult,
  newPhase,
  editPhases,
  connections,
  linkedFeatures,
  setTab,
  visualChangesets,
  editTargeting,
}: Props) {
  const {
    getDatasourceById,
    getMetricById,
    getProjectById,
    datasources,
  } = useDefinitions();

  const { apiCall } = useAuth();

  const router = useRouter();

  const { snapshot } = useSnapshot();

  const [analysisSettingsOpen, setAnalysisSettingsOpen] = useState(false);

  const { hasCommercialFeature, organization } = useUser();
  const project = getProjectById(experiment.project || "");

  const { settings: scopedSettings } = getScopedSettings({
    organization,
    project: project ?? undefined,
    experiment: experiment,
  });

  const datasource = getDatasourceById(experiment.datasource);

  const statsEngine = scopedSettings.statsEngine.value;

  const hasRegressionAdjustmentFeature = hasCommercialFeature(
    "regression-adjustment"
  );

  const allExperimentMetricIds = uniq([
    ...experiment.metrics,
    ...(experiment.guardrails ?? []),
  ]);
  const allExperimentMetrics = allExperimentMetricIds.map((m) =>
    getMetricById(m)
  );
  const denominatorMetricIds = uniq<string>(
    allExperimentMetrics.map((m) => m?.denominator).filter(Boolean) as string[]
  );
  const denominatorMetrics = denominatorMetricIds
    .map((m) => getMetricById(m as string))
    .filter(Boolean) as MetricInterface[];

  const orgSettings = useOrgSettings();

  const [
    regressionAdjustmentAvailable,
    regressionAdjustmentEnabled,
    metricRegressionAdjustmentStatuses,
    regressionAdjustmentHasValidMetrics,
  ] = useMemo(() => {
    const metricRegressionAdjustmentStatuses: MetricRegressionAdjustmentStatus[] = [];
    let regressionAdjustmentAvailable = true;
    let regressionAdjustmentEnabled = true;
    let regressionAdjustmentHasValidMetrics = false;
    for (const metric of allExperimentMetrics) {
      if (!metric) continue;
      const {
        metricRegressionAdjustmentStatus,
      } = getRegressionAdjustmentsForMetric({
        metric: metric,
        denominatorMetrics: denominatorMetrics,
        experimentRegressionAdjustmentEnabled:
          experiment.regressionAdjustmentEnabled ??
          DEFAULT_REGRESSION_ADJUSTMENT_ENABLED,
        organizationSettings: orgSettings,
        metricOverrides: experiment.metricOverrides,
      });
      if (metricRegressionAdjustmentStatus.regressionAdjustmentEnabled) {
        regressionAdjustmentEnabled = true;
        regressionAdjustmentHasValidMetrics = true;
      }
      metricRegressionAdjustmentStatuses.push(metricRegressionAdjustmentStatus);
    }
    if (!experiment.regressionAdjustmentEnabled) {
      regressionAdjustmentEnabled = false;
    }
    if (statsEngine === "bayesian") {
      regressionAdjustmentAvailable = false;
      regressionAdjustmentEnabled = false;
    }
    if (
      !datasource?.type ||
      datasource?.type === "google_analytics" ||
      datasource?.type === "mixpanel"
    ) {
      // these do not implement getExperimentMetricQuery
      regressionAdjustmentAvailable = false;
      regressionAdjustmentEnabled = false;
    }
    if (!hasRegressionAdjustmentFeature) {
      regressionAdjustmentEnabled = false;
    }
    return [
      regressionAdjustmentAvailable,
      regressionAdjustmentEnabled,
      metricRegressionAdjustmentStatuses,
      regressionAdjustmentHasValidMetrics,
    ];
  }, [
    allExperimentMetrics,
    denominatorMetrics,
    orgSettings,
    statsEngine,
    experiment.regressionAdjustmentEnabled,
    experiment.metricOverrides,
    datasource?.type,
    hasRegressionAdjustmentFeature,
  ]);

  const onRegressionAdjustmentChange = async (enabled: boolean) => {
    await apiCall(`/experiment/${experiment.id}/`, {
      method: "POST",
      body: JSON.stringify({
        regressionAdjustmentEnabled: !!enabled,
      }),
    });
    mutate();
  };

  return (
    <>
      <div className="bg-white border mt-3">
        {analysisSettingsOpen && (
          <AnalysisForm
            cancel={() => setAnalysisSettingsOpen(false)}
            experiment={experiment}
            mutate={mutate}
            phase={experiment.phases.length - 1}
            editDates={false}
            editMetrics={true}
            editVariationIds={false}
          />
        )}
        <div className="mb-2" style={{ overflowX: "initial" }}>
          <AnalysisSettingsSummary experiment={experiment} mutate={mutate} />
          {experiment.status === "draft" ? (
            <div className="mx-3">
              <div className="alert bg-light border my-4">
                Your experiment is still in a <strong>draft</strong> state. You
                must start the experiment first before seeing results.
              </div>

              <StartExperimentBanner
                experiment={experiment}
                mutateExperiment={mutate}
                linkedFeatures={linkedFeatures}
                visualChangesets={visualChangesets}
                editTargeting={editTargeting}
                connections={connections}
                openSetupTab={() => setTab("setup")}
                newPhase={newPhase}
              />
            </div>
          ) : (
            <>
              {experiment.status === "running" &&
              !experiment.datasource &&
              !experiment.id.match(/^exp_sample/) ? (
                <div className="alert-cool-1 text-center m-4 px-3 py-4">
                  <p className="h4">Use GrowthBook for Analysis</p>
                  {datasources.length > 0 ? (
                    <>
                      <p>
                        Select a Data Source and metrics so GrowthBook can
                        analyze the experiment results.
                      </p>
                      <button
                        className="btn btn-primary"
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setAnalysisSettingsOpen(true);
                        }}
                      >
                        Select Data Source
                      </button>
                    </>
                  ) : (
                    <>
                      <p>
                        Connect GrowthBook to your data and use our powerful
                        metrics and stats engine to automatically analyze your
                        experiment results.
                      </p>
                      <Link href="/datasources">
                        <a className="btn btn-primary">Connect to your Data</a>
                      </Link>
                    </>
                  )}
                </div>
              ) : (
                <Results
                  experiment={experiment}
                  mutateExperiment={mutate}
                  editMetrics={editMetrics ?? undefined}
                  editResult={editResult ?? undefined}
                  editPhases={editPhases ?? undefined}
                  alwaysShowPhaseSelector={false}
                  hidePhaseSelector={true}
                  reportDetailsLink={false}
                  statsEngine={statsEngine}
                  regressionAdjustmentAvailable={regressionAdjustmentAvailable}
                  regressionAdjustmentEnabled={regressionAdjustmentEnabled}
                  regressionAdjustmentHasValidMetrics={
                    regressionAdjustmentHasValidMetrics
                  }
                  metricRegressionAdjustmentStatuses={
                    metricRegressionAdjustmentStatuses
                  }
                  onRegressionAdjustmentChange={onRegressionAdjustmentChange}
                />
              )}
            </>
          )}
        </div>
      </div>
      {snapshot && (
        <div className="bg-white border mt-4">
          <div className="row mx-2 p-3 d-flex align-items-center">
            <div className="col h3 mb-0">Custom Reports</div>
            <div className="col-auto mr-2">
              <Button
                className="btn btn-outline-primary float-right"
                color="outline-info"
                stopPropagation={true}
                onClick={async () => {
                  const res = await apiCall<{ report: ReportInterface }>(
                    `/experiments/report/${snapshot.id}`,
                    {
                      method: "POST",
                    }
                  );
                  if (!res.report) {
                    throw new Error("Failed to create report");
                  }
                  await router.push(`/report/${res.report.id}`);
                }}
              >
                <GBAddCircle className="pr-1" />
                Custom Report
              </Button>
            </div>
          </div>
          <ExperimentReportsList experiment={experiment} />
        </div>
      )}
    </>
  );
}