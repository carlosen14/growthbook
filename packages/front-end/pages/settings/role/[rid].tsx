import { FC } from "react";
import router from "next/router";
import PageHead from "@/components/Layout/PageHead";
import usePermissionsUtil from "@/hooks/usePermissionsUtils";
import RoleForm from "@/components/Teams/Roles/RoleForm";

const CustomRolePage: FC = () => {
  const { rid, edit } = router.query;
  const permissionsUtil = usePermissionsUtil();

  if (!rid || Array.isArray(rid)) {
    return (
      <div className="container pagecontents">
        <div className="alert alert-danger">
          You do not have access to view this page.
        </div>
      </div>
    );
  }

  if (!permissionsUtil.canManageTeam) {
    return (
      <div className="container pagecontents">
        <div className="alert alert-danger">
          You do not have access to view this page.
        </div>
      </div>
    );
  }
  return (
    <>
      <PageHead
        breadcrumb={[
          {
            display: "Members",
            href: `/settings/team#roles`,
          },
          { display: `${rid}` },
        ]}
      />
      <div className="contents container pagecontents">
        <h1 className="pb-3">{rid}</h1>
        <RoleForm roleId={rid} action={edit ? "editing" : "viewing"} />
      </div>
    </>
  );
};

export default CustomRolePage;
