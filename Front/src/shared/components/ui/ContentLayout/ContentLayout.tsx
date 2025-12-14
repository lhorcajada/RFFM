import React from "react";
import PageHeader from "../PageHeader/PageHeader";
import ActionBar from "../ActionBar/ActionBar";
import styles from "./ContentLayout.module.css";

interface ContentLayoutProps {
  title?: string;
  subtitle?: string;
  actionBar?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  headerClassName?: string;
}

const ContentLayout: React.FC<ContentLayoutProps> = ({
  title,
  subtitle,
  actionBar,
  children,
  className,
  headerClassName,
}) => {
  return (
    <div className={`${styles.wrapper} ${className ?? ""}`.trim()}>
      {title && (
        <PageHeader
          title={title}
          subtitle={subtitle}
          className={headerClassName}
        />
      )}
      {actionBar && <ActionBar>{actionBar}</ActionBar>}
      <div className={styles.content}>{children}</div>
    </div>
  );
};

export default ContentLayout;
