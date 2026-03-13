#!/bin/bash

echo "========================================"
echo "  GeoIP Service Starter"
echo "========================================"
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "[Warning] .env file not found!"
    echo ""
    echo "It is recommended to configure .env file first"
    echo "Copy example config: cp .env.example .env"
    echo ""
    read -p "Continue to start service? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "[Info] Starting GeoIP service..."
echo ""

bun --env-file=.env run index.ts
