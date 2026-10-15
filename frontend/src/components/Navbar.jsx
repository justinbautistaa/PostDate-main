import Header from "../assets/Header.png";
import { Link } from "react-router-dom";
import "./Navbar.css";

function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar-logo">
        <img src={Header} alt="POSTDATE!" />
      </div>

      <nav className="navbar-links">
        <Link to="/">HOME</Link>
        <Link to="/signup">GET STARTED</Link>
      </nav>
    </header>
  );
}

export default Navbar;