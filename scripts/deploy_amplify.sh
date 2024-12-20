#!/bin/bash

APP_NAME="AnyCompanyReads-frontend"
BRANCH_NAME="main"

function build_frontend() {
    cd ~/Workshop/AnyCompanyReads-frontend
    rm ../frontend-build.zip
    npm run build
    cd ~/Workshop/AnyCompanyReads-frontend/build
    zip -r ../../frontend-build.zip *
}

# Amplify helper functions

# Gets an existing Amplify app ID if it exists, 
# else create a new Amplify app and return the ID
function get_amplify_app() {
    APP_ID=$(aws amplify list-apps --output text --query "apps[?name=='$APP_NAME'].appId")
    if [ -z "$APP_ID" ]; then
        echo $(aws amplify create-app --name $APP_NAME --output text --query "app.appId")
    else
        echo ${APP_ID[0]}
    fi
}

function get_amplify_branch() {
    BRANCH=$(aws amplify get-branch --app-id $1 --branch-name $BRANCH_NAME --output text --query "branch.branchName")
    exit_code=$?
    if [[ "$exit_code" -ne 0 ]]; then
        BRANCH=$(aws amplify create-branch --app-id $1 --branch-name $BRANCH_NAME --output text --query "branch.branchName")
    fi
    echo $BRANCH
}

function create_deployment() {
    OUTPUT=$(aws amplify create-deployment --app-id $1 --branch-name $BRANCH_NAME)
    echo $OUTPUT
}

function start_deployment() {
    echo $(aws amplify start-deployment --app-id $1 --branch-name $2 --job-id $3 --output text --query "jobSummary.status")
}

function upload_payload() {
    cd ~/Workshop
    curl --header "Content-Type: application/zip" $url --upload-file frontend-build.zip
}

function deploy_console() {
    exit 1
}

build_frontend
id=$(get_amplify_app)
branch=$(get_amplify_branch $id)
output=$(create_deployment $id)
job_id=`echo $output | jq -r .jobId`
url=`echo $output | jq -r .zipUploadUrl`
upload_payload $url
status=$(start_deployment $id $branch $job_id)
while [ $status != "SUCCEED" ]
do
    echo 'Waiting for AnyCompany Reads frontend application to fully deploy.' >&2
    sleep 10
    status=$(aws amplify list-jobs --app-id $id --branch-name $branch --output text --query "jobSummaries[0].status")
done
app_url=$(aws amplify get-app --app-id $id --output text --query "app.defaultDomain")
echo -e "\n\nAmplify application deployed https://$branch.$app_url"
