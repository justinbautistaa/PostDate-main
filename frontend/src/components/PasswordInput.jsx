import { useId, useState } from "react";
import "./PasswordInput.css";

export default function PasswordInput({ id, disabled, ...props }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [visible, setVisible] = useState(false);
  return <span className="password-field">
    <input {...props} id={inputId} disabled={disabled} type={visible ? "text" : "password"} />
    <button className="password-toggle" type="button" disabled={disabled}
      aria-label={visible ? "Hide password" : "Show password"} aria-controls={inputId}
      aria-pressed={visible} onClick={() => setVisible(value => !value)}>
      {visible ? "Hide" : "Show"}
    </button>
  </span>;
}
