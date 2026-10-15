import { Link } from "react-router-dom";
import SiteNav from "../components/SiteNav";
export default function NotFound() {
  return <><SiteNav /><main style={{ padding: "3rem" }}><h1>Page not found</h1><p>This page does not exist.</p><Link to="/">Go to home</Link></main></>;
}
