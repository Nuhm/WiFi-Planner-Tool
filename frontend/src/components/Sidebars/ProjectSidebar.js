const ProjectSidebar = ({
	projectName,
	setProjectName,
	projectDescription,
	setProjectDescription,
	onClose,
}) => {
	return (
		<>
			<div className="sidebar-header">
				<h3>Project Settings</h3>
				<button className="closeSidebarButton" onClick={onClose}>
					✖ Close
				</button>
			</div>

			<label>Project Name:</label>
			<input
				type="text"
				className="sidebarInputField"
				value={projectName}
				onChange={(e) => setProjectName(e.target.value)}
			/>

			<label>Description:</label>
			<textarea
				className="sidebarInputField"
				rows="6"
				value={projectDescription}
				onChange={(e) => setProjectDescription(e.target.value)}
			/>
		</>
	);
};

export default ProjectSidebar;
