// Redirect to the new patients list page
import { Navigate } from "react-router-dom";

export default function Patients() {
  return <Navigate to="/patients" replace />;
}