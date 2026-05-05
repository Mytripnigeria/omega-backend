pipeline{
    agent any

    stages {
        stage("Build"){
            steps{
                slackSend channel: 'deployments', message: '[Omega Backend App]: Starting build...'
                
                withCredentials([file(credentialsId: 'omega-env-secret', variable: 'ENV_FILE')]) {
                    sh '''
                        # Normalise the secret file for `docker run --env-file`:
                        #   - strip CR (Windows line endings break password matching)
                        #   - drop blank lines and # comments (--env-file does not support them)
                        #   - strip surrounding single/double quotes from values (--env-file
                        #     treats quotes as literal characters, dotenv does not)
                        #   - drop `export ` prefixes if present
                        sed -e 's/\\r$//' \\
                            -e '/^[[:space:]]*#/d' \\
                            -e '/^[[:space:]]*$/d' \\
                            -e 's/^[[:space:]]*export[[:space:]]\\+//' \\
                            -e "s/^\\([A-Za-z_][A-Za-z0-9_]*\\)=[\\"']\\(.*\\)[\\"']\\$/\\1=\\2/" \\
                            "$ENV_FILE" > .env
                        chmod 600 .env
                    '''
                }

                sh "docker rm -f omega_backend_app || true"
                sh "docker build -t omega:backend_app ."
                slackSend message: "[Omega Backend App]: Build $BUILD_NUMBER succeeded", color: 'good'
            }
        }

        stage("Deploy"){
            steps{
                slackSend channel: 'deployments', message: '[Omega Backend App]: Starting deployment...'
                sh "docker run --name omega_backend_app -d -p 9091:9091 --env-file .env omega:backend_app"
            }
        }
    }
    post{
        success{
            slackSend message: "[Omega Backend App]: Successfully deployed to production", color: 'good'
        }
        failure{
            slackSend message: "[Omega Backend App]: Build $BUILD_NUMBER failed", color: 'danger'
        }
    }
}