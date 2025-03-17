import "../styles/Home.css";
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [deleteProjectName, setDeleteProjectName] = useState(null);

  // Load projects from localStorage on page load
  useEffect(() => {
    const savedProjects = JSON.parse(localStorage.getItem("projects")) || [];
    setProjects(savedProjects);
  }, []);

  const handleCreateProject = () => {
    navigate("/project");
  };

  const handleOpenProject = (project) => {
    navigate("/workspace", { state: project });
  };

  // Open the delete confirmation modal
  const confirmDeleteProject = (projectName) => {
    setDeleteProjectName(projectName);
  };

  // Actually delete the project
  const handleDeleteProject = () => {
    if (!deleteProjectName) return;

    const updatedProjects = projects.filter((proj) => proj.name !== deleteProjectName);
    localStorage.setItem("projects", JSON.stringify(updatedProjects));
    setProjects(updatedProjects);
    setDeleteProjectName(null); // Close the modal
  };

  const handleQuit = () => {
    window.electron?.quitApp();
  };

  return (
    <div style={{ textAlign: "center", padding: "50px" }}>
      <h1>WiFi Access Point Tool</h1>

      <button onClick={handleCreateProject} style={{ marginRight: "10px" }}>
        Create Project
      </button>
      <button onClick={handleQuit} style={{ background: "red", color: "white" }}>
        Quit
      </button>

      <h2 style={{ marginTop: "30px" }}>Existing Projects</h2>
      {projects.length === 0 ? (
        <p>No projects found. Create a new one!</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {projects.map((project) => (
            <li key={project.name} style={{ marginBottom: "10px" }}>
              <strong>{project.name}</strong> - {project.description}
              <br />
              <button onClick={() => handleOpenProject(project)} style={{ marginRight: "5px" }}>
                Open
              </button>
              <button onClick={() => confirmDeleteProject(project.name)} style={{ background: "red", color: "white" }}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Delete Confirmation Modal */}
      {deleteProjectName && (
        <>
          <div className="modal-overlay"></div>
          <div className="modal">
            <p>Are you sure you want to delete <strong>{deleteProjectName}</strong>?</p>
            <button className="delete-btn" onClick={handleDeleteProject}>
              Yes, Delete
            </button>
            <button className="cancel-btn" onClick={() => setDeleteProjectName(null)}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Home;
