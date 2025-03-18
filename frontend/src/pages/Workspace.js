import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import CanvasGrid from "../components/CanvasGrid";
import "../styles/Workspace.css";

const Workspace = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="workspace-container">
      
      {/* 🔥 Exit Button (Top-Left Corner) */}
      <button className="exit-button" onClick={() => navigate("/")}>
        ✖ Exit
      </button>

      <PanelGroup direction="horizontal">
        
        {/* Left Side: Canvas */}
        <Panel defaultSize={isSidebarOpen ? 70 : 100} minSize={50} className="canvas-area">
          <CanvasGrid />
          
          {/* 🔥 Floating "Project Settings" Button */}
          {!isSidebarOpen && (
            <button className="project-settings-button" onClick={() => setIsSidebarOpen(true)}>
              Project Settings
            </button>
          )}
        </Panel>

        {/* Resizer Handle (Only visible when sidebar is open) */}
        {isSidebarOpen && <PanelResizeHandle className="resizer" />}

        {/* Right Side: Sidebar (Hidden when `isSidebarOpen` is false) */}
        {isSidebarOpen && (
          <Panel defaultSize={30} minSize={20} maxSize={50} className="sidebar">
            <div className="sidebar-content">
              
              {/* 🔥 Close Sidebar Button */}
              <button className="close-sidebar-button" onClick={() => setIsSidebarOpen(false)}>
                ✖ Close
              </button>

              <h3>Project Settings</h3>

              <label>Project Name:</label>
              <input type="text" className="input-field" />

              <label>Project Description:</label>
              <textarea className="input-field" rows="5"></textarea>
            </div>
          </Panel>
        )}

      </PanelGroup>
    </div>
  );
};

export default Workspace;
