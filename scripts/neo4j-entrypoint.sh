#!/bin/bash
# Neo4j Entrypoint Script
# This script unsets environment variables that Neo4j tries to interpret as config settings
# Coolify may pass NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD globally, which causes errors

# Unset these variables to prevent Neo4j from trying to use them as config
unset NEO4J_URI
unset NEO4J_USER  
unset NEO4J_PASSWORD

# Start Neo4j with the original entrypoint
exec /startup/docker-entrypoint.sh neo4j
