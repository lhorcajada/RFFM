import React from "react";
import styles from "./Address.module.css";

type AddressProps = {
  street?: string;
  city?: string;
  postalCode?: string;
};

export const Address: React.FC<AddressProps> = ({
  street,
  city,
  postalCode,
}) => {
  if (!street && !city && !postalCode) return null;

  return (
    <address className={styles.address}>
      {street && <div className={styles.street}>{street}</div>}
      <div className={styles.meta}>
        {city && <span className={styles.city}>{city}</span>}
        {postalCode && <span className={styles.postal}>{postalCode}</span>}
      </div>
    </address>
  );
};

export default Address;
