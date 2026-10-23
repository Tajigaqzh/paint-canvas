import { Avatar, Button, Dropdown, Empty, Popconfirm, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { documentsApi, type DocumentSummary } from "@/api/documents";
import { setSession, useAuthSession } from "@/api/session";
import { useAppMessage } from "@/hooks/useAppMessage";
import LanguageSwitcher from "@/i18n/LanguageSwitcher";
import { useAppTranslation } from "@/i18n/useAppTranslation";
import "./index.less";

function WorksPage() {
  const { t } = useAppTranslation();
  const message = useAppMessage();
  const navigate = useNavigate();
  const session = useAuthSession();
  const [works, setWorks] = useState<DocumentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string>();

  const loadWorks = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await documentsApi.list({ limit: 100, offset: 0 });
      setWorks(result.items);
    } catch {
      message.error(t("workLoadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [message, t]);

  useEffect(() => {
    void loadWorks();
  }, [loadWorks]);

  const deleteWork = async (id: string) => {
    setDeletingId(id);
    try {
      await documentsApi.delete(id);
      setWorks((current) => current.filter((work) => work.id !== id));
      message.success(t("workDeleted"));
    } catch {
      message.error(t("workDeleteFailed"));
    } finally {
      setDeletingId(undefined);
    }
  };

  const columns: ColumnsType<DocumentSummary> = [
    {
      dataIndex: "name",
      key: "name",
      render: (name: string, work) => (
        <Button
          className="works-page__work-name"
          type="link"
          onClick={() => navigate(`/editor/${work.id}`)}
        >
          {name}
        </Button>
      ),
      title: t("workName"),
    },
    {
      dataIndex: "updatedAt",
      key: "updatedAt",
      render: (value: string) => new Date(value).toLocaleString(),
      title: t("lastUpdated"),
      width: 230,
    },
    {
      key: "actions",
      render: (_value, work) => (
        <Popconfirm
          cancelText={t("cancel")}
          okText={t("delete")}
          title={t("deleteWorkConfirm")}
          onConfirm={() => void deleteWork(work.id)}
        >
          <Button danger loading={deletingId === work.id} type="text">
            {t("deleteWork")}
          </Button>
        </Popconfirm>
      ),
      title: "",
      width: 120,
    },
  ];

  const displayName = session?.user.displayName || session?.user.email || "?";
  const avatarText = displayName.trim().charAt(0).toLocaleUpperCase();

  return (
    <main className="works-page">
      <header className="works-page__header">
        <Typography.Text className="works-page__brand">{t("homeTitle")}</Typography.Text>
        <Space size={16}>
          <LanguageSwitcher />
          <Dropdown
            menu={{
              items: [{ key: "signOut", label: t("signOut") }],
              onClick: ({ key }) => {
                if (key === "signOut") {
                  setSession(null);
                  navigate("/login", { replace: true });
                }
              },
            }}
            placement="bottomRight"
            trigger={["click"]}
          >
            <button
              aria-label={`${t("account")}: ${displayName}`}
              className="works-page__account"
              type="button"
            >
              <Avatar className="works-page__avatar">{avatarText}</Avatar>
              <span>{displayName}</span>
            </button>
          </Dropdown>
        </Space>
      </header>
      <section className="works-page__content">
        <div className="works-page__title-row">
          <div>
            <h1>{t("myWorks")}</h1>
            <Typography.Text type="secondary">{session?.user.email}</Typography.Text>
          </div>
          <Button type="primary" onClick={() => navigate("/editor/new")}>
            {t("newWork")}
          </Button>
        </div>
        {works.length === 0 && !isLoading ? (
          <Empty className="works-page__empty" description={t("noDocuments")}>
            <Button type="primary" onClick={() => navigate("/editor/new")}>
              {t("newWork")}
            </Button>
          </Empty>
        ) : (
          <Table
            columns={columns}
            dataSource={works}
            loading={isLoading}
            pagination={{ pageSize: 20, showSizeChanger: false }}
            rowKey="id"
            size="middle"
          />
        )}
      </section>
    </main>
  );
}

export default WorksPage;
