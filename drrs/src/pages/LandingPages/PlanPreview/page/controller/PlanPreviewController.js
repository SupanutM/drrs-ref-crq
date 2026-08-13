import React from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";

import PlanPreviewView from "../view/PlanPreviewView";

function PlanPreviewController(props) {
    const navigate = useNavigate();
    const { routerState } = props;

    const handleRoute = () => {
        navigate("/drrs/select-plan", { state: routerState });
    };

    const handlers = {
        handleRoute,
    };

    return <PlanPreviewView handlers={handlers} />;
}

PlanPreviewController.propTypes = {
    routerState: PropTypes.object
};

export default PlanPreviewController;
