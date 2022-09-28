import React, { useEffect, useState } from "react";
import LoadingOverlay from "../../components/LoadingOverlay";
import { useAuth } from "../../services/auth";
import { FaPencilAlt } from "react-icons/fa";
import EditOrganizationForm from "../../components/Settings/EditOrganizationForm";
import { useForm } from "react-hook-form";
import VisualEditorInstructions from "../../components/Settings/VisualEditorInstructions";
import track from "../../services/track";
import BackupConfigYamlButton from "../../components/Settings/BackupConfigYamlButton";
import RestoreConfigYamlButton from "../../components/Settings/RestoreConfigYamlButton";
import { hasFileConfig, isCloud } from "../../services/env";
import { OrganizationSettings } from "back-end/types/organization";
import isEqual from "lodash/isEqual";
import Field from "../../components/Forms/Field";
import MetricsSelector from "../../components/Experiment/MetricsSelector";
import cronstrue from "cronstrue";
import TempMessage from "../../components/TempMessage";
import Button from "../../components/Button";
import { DocLink } from "../../components/DocLink";
import { useOrganizationMetricDefaults } from "../../hooks/useOrganizationMetricDefaults";
import { useAdminSettings } from "../../hooks/useAdminSettings";

function hasChanges(
  value: OrganizationSettings,
  existing: OrganizationSettings
) {
  if (!existing) return true;

  return !isEqual(value, existing);
}

const GeneralSettingsPage = (): React.ReactElement => {
  const { data, error, refresh: mutate } = useAdminSettings();

  const [editOpen, setEditOpen] = useState(false);
  const [saveMsg, setSaveMsg] = useState(false);
  const [originalValue, setOriginalValue] = useState<OrganizationSettings>({});

  const { metricDefaults } = useOrganizationMetricDefaults();

  const form = useForm<OrganizationSettings>({
    defaultValues: {
      visualEditorEnabled: false,
      pastExperimentsMinLength: 6,
      metricAnalysisDays: 90,
      // customization:
      customized: false,
      logoPath: "",
      primaryColor: "#391c6d",
      secondaryColor: "#50279a",
      northStar: {
        //enabled: false,
        title: "",
        metricIds: [],
        //target: [],
        //window: "",
        //resolution?: string;
        //startDate?: Date;
      },
      metricDefaults: {
        minimumSampleSize: metricDefaults.minimumSampleSize,
        maxPercentageChange: metricDefaults.maxPercentageChange * 100,
        minPercentageChange: metricDefaults.minPercentageChange * 100,
      },
      updateSchedule: {
        type: "stale",
        hours: 6,
        cron: "0 */6 * * *",
      },
      multipleExposureMinPercent: 0.01,
    },
  });
  const { apiCall, organizations, setOrganizations, orgId } = useAuth();

  const value = {
    visualEditorEnabled: form.watch("visualEditorEnabled"),
    pastExperimentsMinLength: form.watch("pastExperimentsMinLength"),
    metricAnalysisDays: form.watch("metricAnalysisDays"),
    metricDefaults: {
      minimumSampleSize: form.watch("metricDefaults.minimumSampleSize"),
      maxPercentageChange: form.watch("metricDefaults.maxPercentageChange"),
      minPercentageChange: form.watch("metricDefaults.minPercentageChange"),
    },
    // customization:
    customized: form.watch("customized"),
    logoPath: form.watch("logoPath"),
    primaryColor: form.watch("primaryColor"),
    secondaryColor: form.watch("secondaryColor"),
    northStar: form.watch("northStar"),
    updateSchedule: form.watch("updateSchedule"),
    multipleExposureMinPercent: form.watch("multipleExposureMinPercent"),
  };

  const [cronString, setCronString] = useState("");

  function updateCronString(cron?: string) {
    cron = cron || value.updateSchedule?.cron || "";

    if (!cron) {
      setCronString("");
    }
    setCronString(
      cronstrue.toString(cron, {
        throwExceptionOnParseError: false,
      })
    );
  }

  useEffect(() => {
    if (data?.organization?.settings) {
      const newVal = { ...form.getValues() };
      Object.keys(newVal).forEach((k) => {
        newVal[k] = data.organization.settings?.[k] || newVal[k];

        // Existing values are stored as a multiplier, e.g. 50% on the UI is stored as 0.5
        // Transform these values from the UI format
        if (k === "metricDefaults") {
          newVal.metricDefaults = {
            ...newVal.metricDefaults,
            maxPercentageChange:
              newVal.metricDefaults.maxPercentageChange * 100,
            minPercentageChange:
              newVal.metricDefaults.minPercentageChange * 100,
          };
        }
      });
      form.reset(newVal);
      setOriginalValue(newVal);
      updateCronString(newVal.updateSchedule?.cron || "");
    }
  }, [data?.organization?.settings]);

  if (error) {
    return <div className="alert alert-danger">An error occurred: {error}</div>;
  }
  if (!data) {
    return <LoadingOverlay />;
  }

  const ctaEnabled = hasChanges(value, originalValue);

  const saveSettings = async () => {
    const enabledVisualEditor =
      !data?.organization?.settings?.visualEditorEnabled &&
      value.visualEditorEnabled;

    const transformedOrgSettings = {
      ...value,
      metricDefaults: {
        ...value.metricDefaults,
        maxPercentageChange: value.metricDefaults.maxPercentageChange / 100,
        minPercentageChange: value.metricDefaults.minPercentageChange / 100,
      },
    };

    await apiCall(`/organization`, {
      method: "PUT",
      body: JSON.stringify({
        settings: transformedOrgSettings,
      }),
    });
    await mutate();
    organizations.forEach((org) => {
      if (org.id === orgId) {
        org.settings = transformedOrgSettings;
      }
    });
    setOrganizations(organizations);

    // Track usage of the Visual Editor
    if (enabledVisualEditor) {
      track("Enable Visual Editor");
    }

    // show the user that the settings have saved:
    setSaveMsg(true);
  };

  return (
    <div className="container-fluid pagecontents">
      {saveMsg && (
        <TempMessage
          close={() => {
            setSaveMsg(false);
          }}
        >
          Settings saved
        </TempMessage>
      )}
      {editOpen && (
        <EditOrganizationForm
          name={data.organization.name}
          close={() => setEditOpen(false)}
          mutate={mutate}
        />
      )}
      <h1>General Settings</h1>
      <div className="mb-1">
        <div className=" bg-white p-3 border">
          <div className="row">
            <div className="col-sm-3">
              <h4>Organization</h4>
            </div>
            <div className="col-sm-9">
              <div className="form-group row">
                <div className="col-sm-12">
                  <strong>Name: </strong> {data.organization.name}{" "}
                  <a
                    href="#"
                    className="pl-1"
                    onClick={(e) => {
                      e.preventDefault();
                      setEditOpen(true);
                    }}
                  >
                    <FaPencilAlt />
                  </a>
                </div>
              </div>
              <div className="form-group row">
                <div className="col-sm-12">
                  <strong>Owner:</strong> {data.organization.ownerEmail}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="my-3 bg-white p-3 border">
          <div className="row">
            <div className="col-sm-3">
              <h4>North Star Metrics</h4>
            </div>
            <div className="col-sm-9">
              <p>
                North stars are metrics your team is focused on improving. These
                metrics are shown on the home page with the experiments that
                have the metric as a goal.
              </p>
              <div className={"form-group"}>
                <div className="my-3">
                  <div className="form-group">
                    <label>Metric(s)</label>
                    <MetricsSelector
                      selected={form.watch("northStar.metricIds")}
                      onChange={(metrics) =>
                        form.setValue("northStar.metricIds", metrics)
                      }
                    />
                  </div>
                  <Field label="Title" {...form.register("northStar.title")} />
                </div>
              </div>
            </div>
          </div>
        </div>
        {hasFileConfig() && (
          <div className="alert alert-info my-3">
            The below settings are controlled through your{" "}
            <code>config.yml</code> file and cannot be changed through the web
            UI.{" "}
            <DocLink
              docSection="config_organization_settings"
              className="font-weight-bold"
            >
              View Documentation
            </DocLink>
            .
          </div>
        )}
        {!hasFileConfig() && (
          <div className="alert alert-info my-3">
            <h3>Import/Export config.yml</h3>
            <p>
              {isCloud()
                ? "GrowthBook Cloud stores"
                : "You are currently storing"}{" "}
              all organization settings, data sources, metrics, and dimensions
              in a database.
            </p>
            <p>
              You can import/export these settings to a <code>config.yml</code>{" "}
              file to more easily move between GrowthBook Cloud accounts and/or
              self-hosted environments.{" "}
              <DocLink docSection="config_yml" className="font-weight-bold">
                Learn More
              </DocLink>
            </p>
            <div className="row mb-3">
              <div className="col-auto">
                <BackupConfigYamlButton
                  settings={data?.organization?.settings}
                />
              </div>
              <div className="col-auto">
                <RestoreConfigYamlButton
                  settings={data?.organization?.settings}
                  mutate={mutate}
                />
              </div>
            </div>
            <div className="text-muted">
              <strong>Note:</strong> For security reasons, the exported file
              does not include data source connection secrets such as passwords.
              You must edit the file and add these yourself.
            </div>
          </div>
        )}
        <div className="bg-white p-3 border">
          <div className="row">
            <div className="col-sm-3">
              <h4>
                Visual Editor <span className="badge badge-warning">beta</span>
              </h4>
            </div>
            <div className="col-sm-9 pb-3">
              <p>
                {`The Visual Editor allows non-technical users to create and start
                experiments in production without writing any code. `}
                <DocLink docSection="visual_editor">View Documentation</DocLink>
              </p>
              <div>
                <div className="form-check">
                  <input
                    type="checkbox"
                    disabled={hasFileConfig()}
                    className="form-check-input "
                    {...form.register("visualEditorEnabled")}
                    id="checkbox-visualeditor"
                  />

                  <label
                    htmlFor="checkbox-visualeditor"
                    className="form-check-label"
                  >
                    Enable Visual Editor
                  </label>
                </div>
              </div>
              {value.visualEditorEnabled &&
                data.organization.settings?.visualEditorEnabled && (
                  <div className="bg-light p-3 my-3 border rounded">
                    <h5 className="font-weight-bold">Setup Instructions</h5>
                    <VisualEditorInstructions
                      apiKeys={data.apiKeys}
                      mutate={mutate}
                    />
                  </div>
                )}
            </div>
          </div>

          <div className="divider border-bottom mb-3 mt-3" />

          <div className="row">
            <div className="col-sm-3">
              <h4>Experiment Settings</h4>
            </div>

            <div className="col-sm-9 form-inline">
              <Field
                label="Minimum experiment length (in days) when importing past
                experiments"
                type="number"
                className="ml-2"
                containerClassName="mb-3"
                append="days"
                step="1"
                min="0"
                max="31"
                disabled={hasFileConfig()}
                {...form.register("pastExperimentsMinLength", {
                  valueAsNumber: true,
                })}
              />

              <Field
                label="Warn when this percent of experiment users are in multiple variations"
                type="number"
                step="any"
                min="0"
                max="1"
                className="ml-2"
                containerClassName="mb-3"
                disabled={hasFileConfig()}
                helpText={<span className="ml-2">from 0 to 1</span>}
                {...form.register("multipleExposureMinPercent", {
                  valueAsNumber: true,
                })}
              />

              <div className="mb-3">
                <Field
                  label="Experiment Auto-Update Frequency"
                  className="ml-2"
                  containerClassName="mb-2 mr-2"
                  disabled={hasFileConfig()}
                  options={[
                    {
                      display: "When results are X hours old",
                      value: "stale",
                    },
                    {
                      display: "Cron Schedule",
                      value: "cron",
                    },
                    {
                      display: "Never",
                      value: "never",
                    },
                  ]}
                  {...form.register("updateSchedule.type")}
                />
                {value.updateSchedule?.type === "stale" && (
                  <div className="bg-light p-3 border">
                    <Field
                      label="Refresh when"
                      append="hours old"
                      type="number"
                      step={1}
                      min={1}
                      max={168}
                      className="ml-2"
                      disabled={hasFileConfig()}
                      {...form.register("updateSchedule.hours", {
                        valueAsNumber: true,
                      })}
                    />
                  </div>
                )}
                {value.updateSchedule?.type === "cron" && (
                  <div className="bg-light p-3 border">
                    <Field
                      label="Cron String"
                      className="ml-2"
                      disabled={hasFileConfig()}
                      {...form.register("updateSchedule.cron")}
                      placeholder="0 */6 * * *"
                      onFocus={(e) => {
                        updateCronString(e.target.value);
                      }}
                      onBlur={(e) => {
                        updateCronString(e.target.value);
                      }}
                      helpText={<span className="ml-2">{cronString}</span>}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="divider border-bottom mb-3 mt-3" />

          <div className="row">
            <div className="col-sm-3">
              <h4>Metrics Settings</h4>
            </div>
            <div className="col-sm-9">
              <div className="form-inline">
                <Field
                  label="Amount of historical data to include when analyzing metrics"
                  append="days"
                  className="ml-2"
                  containerClassName="mb-3"
                  disabled={hasFileConfig()}
                  options={[7, 14, 30, 90, 180, 365]}
                  {...form.register("metricAnalysisDays", {
                    valueAsNumber: true,
                  })}
                />
              </div>

              {/* region Metrics Behavior Defaults */}
              <>
                <h5 className="mt-3">Metrics Behavior Defaults</h5>
                <p>
                  These are the pre-configured default values that will be used
                  when configuring metrics. You can always change these values
                  on a per-metric basis.
                </p>

                {/* region Minimum Sample Size */}
                <div>
                  <div className="form-inline">
                    <Field
                      label="Minimum Sample Size"
                      type="number"
                      className="ml-2"
                      containerClassName="mt-2"
                      disabled={hasFileConfig()}
                      {...form.register("metricDefaults.minimumSampleSize", {
                        valueAsNumber: true,
                      })}
                    />
                  </div>
                  <p>
                    <small className="text-muted mb-3">
                      The total count required in an experiment variation before
                      showing results
                    </small>
                  </p>
                </div>
                {/* endregion Minimum Sample Size */}

                {/* region Maximum Percentage Change */}
                <div>
                  <div className="form-inline">
                    <Field
                      label="Maximum Percentage Change"
                      type="number"
                      append="%"
                      className="ml-2"
                      containerClassName="mt-2"
                      disabled={hasFileConfig()}
                      {...form.register("metricDefaults.maxPercentageChange", {
                        valueAsNumber: true,
                      })}
                    />
                  </div>
                  <p>
                    <small className="text-muted mb-3">
                      An experiment that changes the metric by more than this
                      percent will be flagged as suspicious
                    </small>
                  </p>
                </div>
                {/* endregion Maximum Percentage Change */}

                {/* region Minimum Percentage Change */}
                <div>
                  <div className="form-inline">
                    <Field
                      label="Minimum Percentage Change"
                      type="number"
                      append="%"
                      className="ml-2"
                      containerClassName="mt-2"
                      disabled={hasFileConfig()}
                      {...form.register("metricDefaults.minPercentageChange", {
                        valueAsNumber: true,
                      })}
                    />
                  </div>
                  <p>
                    <small className="text-muted mb-3">
                      An experiment that changes the metric by less than this
                      percent will be considered a draw
                    </small>
                  </p>
                </div>
                {/* endregion Minimum Percentage Change */}
              </>
              {/* endregion Metrics Behavior Defaults */}
            </div>
          </div>
          <div className="divider border-bottom mb-3 mt-3" />

          <div className="row">
            <div className="col-12">
              <div className=" d-flex flex-row-reverse">
                <Button
                  color={"primary"}
                  disabled={!ctaEnabled}
                  onClick={async () => {
                    if (!ctaEnabled) return;
                    await saveSettings();
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeneralSettingsPage;
