pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  environment {
    // Host path bind-mounted into the Jenkins container (see docker-compose.yml)
    APP_DIR = '/opt/visa'
    // Always target the deploy tree; do not dir(APP_DIR) — jenkins cannot create APP_DIR@tmp
    COMPOSE = 'docker compose -f /opt/visa/docker-compose.yml --project-directory /opt/visa'
  }

  stages {
    stage('Sync to deploy dir') {
      steps {
        sh '''
          set -e
          mkdir -p "${APP_DIR}"
          # No -a/-t owner/group/times: jenkins (uid 1000) cannot setattr on root files
          if command -v rsync >/dev/null 2>&1; then
            rsync -rlD --delete \
              --exclude '.env' \
              --exclude 'neon.dump' \
              --exclude '.git' \
              --exclude 'jenkins_home' \
              ./ "${APP_DIR}/"
          else
            find "${APP_DIR}" -mindepth 1 -maxdepth 1 \
              ! -name '.env' ! -name 'neon.dump' ! -name '.git' \
              -exec rm -rf {} +
            cp -rT ./ "${APP_DIR}/" 2>/dev/null || cp -a ./ "${APP_DIR}/"
          fi
          test -f "${APP_DIR}/.env" || {
            echo "Missing ${APP_DIR}/.env — copy from deploy/env.production.example"
            exit 1
          }
          grep -q '^DATABASE_URL=' "${APP_DIR}/.env"
          grep -q '^DOMAIN=' "${APP_DIR}/.env"
        '''
      }
    }

    stage('Build') {
      steps {
        sh '${COMPOSE} build app migrate'
      }
    }

    stage('Migrate') {
      steps {
        // After Neon cutover: apply pending Drizzle migrations (no-op if already applied).
        sh '''
          set -e
          # Host Postgres (not Compose). migrate container uses host.docker.internal.
          ${COMPOSE} --profile migrate run --rm migrate
        '''
      }
    }

    stage('Deploy') {
      steps {
        sh '''
          set -e
          ${COMPOSE} up -d --remove-orphans app caddy
          ${COMPOSE} up -d jenkins
        '''
      }
    }

    stage('Health') {
      steps {
        sh '''
          set -e
          for i in $(seq 1 30); do
            if ${COMPOSE} exec -T app curl -fsS http://127.0.0.1:3000/api/health; then
              echo
              echo "Health OK (app container)"
              exit 0
            fi
            echo "Waiting for app health ($i/30)..."
            sleep 2
          done
          echo "App health check failed"
          ${COMPOSE} ps
          ${COMPOSE} logs --tail=80 app || true
          exit 1
        '''
      }
    }
  }

  post {
    failure {
      sh '${COMPOSE} ps || true'
    }
  }
}
