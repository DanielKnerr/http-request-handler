/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    collectCoverage: true,
    collectCoverageFrom: [
        "<rootDir>/src/*.ts",
    ],
    testMatch: [
        "<rootDir>/tests/*.ts"
    ],
    modulePathIgnorePatterns: [
        "<rootDir>/tests/util.ts"
    ]
};