import React from "react";
import PropTypes from "prop-types";

import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";

import MKBox from "components/MKBox";
import MKButton from "components/MKButton";

function PlanPreviewView(props) {
    const { handlers } = props;
    const { handleRoute } = handlers;

    return (
        <MKBox component="section">
            <Container>
                <Grid container item xs={12} justifyContent="center" mx="auto">

                    <Grid container justifyContent="center" py={4}>
                        <Grid item xs={12} md={10} mx={{ xs: "auto", sm: 6, md: 1 }}>
                            <MKBox
                                component="img"
                                src={`${process.env.PUBLIC_URL}/assets/images/Info.jpg`}
                                alt="Plan Preview"
                                width="100%"
                                borderRadius="md"
                                shadow="lg"
                                textAlign="center"
                            />
                        </Grid>
                    </Grid>

                    <Grid container justifyContent="center" py={2}>
                        <MKButton variant="contained" color="primary" onClick={handleRoute}>
                            ดำเนินการต่อ
                        </MKButton>
                    </Grid>
                </Grid>
            </Container>
        </MKBox>
    );
}

PlanPreviewView.propTypes = {
    handlers: PropTypes.object.isRequired,
};

export default PlanPreviewView;
