import { Alert, Button, Form, Input, Segmented } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "@/api/auth";
import { setSession } from "@/api/session";
import LanguageSwitcher from "@/i18n/LanguageSwitcher";
import { useAppTranslation } from "@/i18n/useAppTranslation";
import type { AuthInput } from "@/api/auth";
import "./index.less";

function LoginPage() {
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [form] = Form.useForm<AuthInput>();

  const submit = async (values: AuthInput) => {
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      const session =
        mode === "login" ? await authApi.login(values) : await authApi.register(values);
      setSession({ token: session.token, user: session.user });
      navigate("/works", { replace: true });
    } catch (error) {
      const code = (error as { code?: string }).code;
      setErrorMessage(
        code === "email_taken"
          ? t("emailTaken")
          : code === "invalid_credentials"
            ? t("invalidCredentials")
            : t(mode === "login" ? "loginFailed" : "registerFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <header className="login-page__topbar">
        <span className="login-page__brand">{t("homeTitle")}</span>
        <LanguageSwitcher />
      </header>
      <section className="login-page__content">
        <div className="login-page__form">
          <h1>{t(mode === "login" ? "loginTitle" : "registerTitle")}</h1>
          <Segmented
            block
            options={[
              { label: t("login"), value: "login" },
              { label: t("register"), value: "register" },
            ]}
            value={mode}
            onChange={(value) => {
              setMode(value as "login" | "register");
              setErrorMessage("");
            }}
          />
          {errorMessage && (
            <Alert className="login-page__error" message={errorMessage} type="error" />
          )}
          <Form form={form} layout="vertical" requiredMark={false} onFinish={submit}>
            {mode === "register" && (
              <Form.Item label={t("displayName")} name="displayName" rules={[{ max: 80 }]}>
                <Input autoComplete="nickname" />
              </Form.Item>
            )}
            <Form.Item label={t("email")} name="email" rules={[{ required: true, type: "email" }]}>
              <Input autoComplete="email" type="email" />
            </Form.Item>
            <Form.Item
              extra={mode === "register" ? t("passwordHint") : undefined}
              label={t("password")}
              name="password"
              rules={[{ min: 8, required: true }]}
            >
              <Input.Password
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </Form.Item>
            <Button block htmlType="submit" loading={isSubmitting} type="primary">
              {t(mode === "login" ? "login" : "register")}
            </Button>
          </Form>
        </div>
      </section>
    </main>
  );
}

export default LoginPage;
