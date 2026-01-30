# Implementation Plan: TABEZA Architectural Restructure

## Overview

This implementation plan converts the architectural restructure design into discrete coding tasks that will cleanly separate cloud and on-premises components. The approach follows a careful migration strategy to preserve functionality while establishing proper architectural boundaries.

## Tasks

- [x] 1. Analyze and catalog current component dependencies
  - Scan all packages for OS-specific dependencies and imports
  - Create dependency matrix showing cloud vs infrastructure components
  - Document current coupling points between systems
  - _Requirements: 4.1, 1.1, 1.2_

- [ ] 2. Extract pure parsing logic from virtual-printer
  - [x] 2.1 Create packages/escpos-parser package structure
    - Set up TypeScript package with proper exports
    - Configure build pipeline and testing framework
    - _Requirements: 3.1, 3.4_
  
  - [ ]* 2.2 Write property test for ESC/POS parsing purity
    - **Property 6: Pure Logic Serverless Compatibility**
    - **Validates: Requirements 3.1, 3.3, 3.5**
  
  - [x] 2.3 Extract format detection logic without OS dependencies
    - Move format detection algorithms to pure functions
    - Remove file system and OS API dependencies
    - _Requirements: 3.1, 3.3_
  
  - [x] 2.4 Extract receipt parsing algorithms
    - Move regex-based pattern matching to pure functions
    - Extract line positioning analysis logic
    - Remove printer driver dependencies
    - _Requirements: 3.1, 3.4_
  
  - [ ]* 2.5 Write property test for cross-system usability
    - **Property 7: Pure Logic Cross-System Usability**
    - **Validates: Requirements 3.2**

- [ ] 3. Create tax-rules package for KRA compliance logic
  - [x] 3.1 Set up packages/tax-rules package structure
    - Create TypeScript package for tax calculation logic
    - Set up Zod schemas for tax rule validation
    - _Requirements: 3.1, 3.4_
  
  - [x] 3.2 Extract tax calculation algorithms from existing code
    - Move KRA PIN validation logic to pure functions
    - Extract tax rate calculation algorithms
    - Remove any jurisdiction-specific file dependencies
    - _Requirements: 3.1, 3.4_
  
  - [ ]* 3.3 Write property test for tax calculation consistency
    - Test tax calculations across different scenarios
    - Validate KRA compliance rules
    - _Requirements: 3.4_

- [ ] 4. Create validation package for cross-system consistency
  - [x] 4.1 Set up packages/validation package structure
    - Create shared validation utilities package
    - Configure for consumption by both systems
    - _Requirements: 3.1, 2.5_
  
  - [x] 4.2 Extract business rule validation logic
    - Move receipt validation rules to pure functions
    - Extract data sanitization functions
    - Create cross-system validation consistency utilities
    - _Requirements: 2.5, 3.1_
  
  - [ ]* 4.3 Write property test for validation consistency
    - **Property 4: Schema Consumption Consistency**
    - **Validates: Requirements 2.2, 2.5**

- [x] 5. Checkpoint - Verify pure logic extraction
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Prepare receipt-schema for independent publishing
  - [x] 6.1 Configure receipt-schema as standalone npm package
    - Update package.json for independent publishing
    - Set up semantic versioning configuration
    - Configure npm publish scripts
    - _Requirements: 2.1, 2.4, 8.1_
  
  - [x] 6.2 Add schema version compatibility utilities
    - Create version validation functions
    - Add backward compatibility checking
    - Implement migration utilities for breaking changes
    - _Requirements: 2.3, 6.1, 6.3_
  
  - [ ]* 6.3 Write property test for schema version compatibility
    - **Property 5: Schema Version Compatibility**
    - **Validates: Requirements 2.3, 6.1, 6.3**
  
  - [x] 6.4 Add comprehensive schema validation tests
    - Ensure all schema changes include validation tests
    - Test cross-version data consistency
    - _Requirements: 9.4, 6.5_
  
  - [ ]* 6.5 Write property test for cross-version data consistency
    - **Property 11: Cross-Version Data Consistency**
    - **Validates: Requirements 6.5**

- [-] 7. Remove infrastructure components from cloud system
  - [x] 7.1 Remove packages/printer-agent directory
    - Delete Windows Service code and dependencies
    - Remove print spooler monitoring components
    - Clean up any references in other packages
    - _Requirements: 4.5, 1.1_
  
  - [x] 7.2 Remove packages/virtual-printer directory
    - Delete print capture and OS-dependent components
    - Preserve any pure logic that was extracted earlier
    - Clean up imports and references
    - _Requirements: 4.5, 1.1_
  
  - [x] 7.3 Update package.json and workspace configuration
    - Remove infrastructure packages from workspace
    - Clean up dependencies and scripts
    - Update build pipeline configuration
    - _Requirements: 1.1, 1.4_
  
  - [ ]* 7.4 Write property test for cloud system purity
    - **Property 1: Cloud System Purity**
    - **Validates: Requirements 1.1, 1.4**

- [x] 8. Create agent repository structure planning
  - [x] 8.1 Design agent repository structure
    - Plan directory structure for Windows agent
    - Design package.json for agent system
    - Plan npm linking strategy for shared packages
    - _Requirements: 1.2, 8.2, 8.5_
  
  - [x] 8.2 Create agent system component specifications
    - Specify Windows Service architecture
    - Define SQLite database schema and operations
    - Plan print spooler integration approach
    - _Requirements: 4.2, 4.3, 4.4_
  
  - [x] 8.3 Plan schema consumption strategy for agent
    - Design npm package consumption approach
    - Plan version compatibility checking
    - Design local development linking strategy
    - _Requirements: 2.2, 6.2, 8.2_

- [x] 9. Update cloud system to use extracted packages
  - [x] 9.1 Update imports to use new pure logic packages
    - Replace virtual-printer imports with escpos-parser
    - Update tax calculation imports to use tax-rules package
    - Update validation imports to use validation package
    - _Requirements: 3.2_
  
  - [x] 9.2 Update build configuration for new packages
    - Configure Turbo to build new packages
    - Update TypeScript configuration for new imports
    - Configure Next.js to transpile new packages
    - _Requirements: 3.2_
  
  - [ ]* 9.3 Write property test for migration functional preservation
    - **Property 12: Migration Functional Preservation**
    - **Validates: Requirements 7.1, 7.2**

- [x] 10. Implement deployment independence validation
  - [x] 10.1 Configure separate deployment pipelines
    - Set up Vercel deployment for cloud system only
    - Plan MSI installer approach for agent system
    - Configure npm publishing for shared packages
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [x] 10.2 Create deployment validation scripts
    - Script to validate cloud system has no OS dependencies
    - Script to validate agent system is self-contained
    - Script to validate schema publishing process
    - _Requirements: 1.4, 1.5, 5.3_
  
  - [ ]* 10.3 Write property test for deployment independence
    - **Property 9: Deployment Independence**
    - **Validates: Requirements 5.5**

- [-] 11. Create migration validation and rollback procedures
  - [x] 11.1 Create migration validation scripts
    - Script to validate architectural boundary enforcement
    - Script to validate component placement correctness
    - Script to validate dependency purity
    - _Requirements: 7.3, 1.3_
  
  - [ ]* 11.2 Write property test for architectural boundary enforcement
    - **Property 3: Architectural Boundary Enforcement**
    - **Validates: Requirements 1.3**
  
  - [-] 11.3 Create rollback procedures
    - Document rollback steps for each migration phase
    - Create rollback validation scripts
    - Test rollback procedures in safe environment
    - _Requirements: 7.5_
  
  - [ ]* 11.4 Write property test for migration validation completeness
    - **Property 13: Migration Validation Completeness**
    - **Validates: Requirements 7.3**

- [ ] 12. Update testing infrastructure
  - [ ] 12.1 Configure property-based testing with fast-check
    - Set up fast-check for all property tests
    - Configure minimum 100 iterations per test
    - Set up proper test tagging system
    - _Requirements: 9.1, 9.5_
  
  - [ ] 12.2 Create cross-system integration test framework
    - Design tests that span cloud and agent boundaries
    - Create mock agent for cloud system testing
    - Plan integration test execution strategy
    - _Requirements: 9.5_
  
  - [ ]* 12.3 Write property test for test suite preservation
    - **Property 17: Test Suite Preservation**
    - **Validates: Requirements 9.1, 9.3**
  
  - [ ]* 12.4 Write property test for cross-system integration testing
    - **Property 18: Cross-System Integration Testing**
    - **Validates: Requirements 9.5**

- [ ] 13. Create comprehensive documentation
  - [ ] 13.1 Create architectural decision records
    - Document rationale for cloud/agent separation
    - Record decisions about package structure
    - Document npm linking strategy decisions
    - _Requirements: 10.1, 10.4_
  
  - [ ] 13.2 Create setup instructions for both systems
    - Write cloud system development setup guide
    - Write agent system development setup guide
    - Document npm linking procedures for development
    - _Requirements: 10.2_
  
  - [ ] 13.3 Create API documentation for system communication
    - Document how systems communicate and share data
    - Specify data synchronization protocols
    - Document error handling across system boundaries
    - _Requirements: 10.3_
  
  - [ ] 13.4 Create troubleshooting guide
    - Document common cross-system integration issues
    - Provide solutions for schema version conflicts
    - Document deployment and linking troubleshooting
    - _Requirements: 10.5_

- [ ] 14. Final validation and cleanup
  - [ ] 14.1 Run comprehensive validation suite
    - Execute all property tests across both systems
    - Validate architectural boundaries are enforced
    - Confirm all functionality is preserved
    - _Requirements: 7.1, 1.3_
  
  - [ ] 14.2 Clean up temporary files and unused dependencies
    - Remove any temporary migration files
    - Clean up unused dependencies from package.json files
    - Optimize package sizes and build outputs
    - _Requirements: 1.1, 1.2_
  
  - [ ] 14.3 Prepare for agent repository creation
    - Finalize agent system specifications
    - Prepare git history extraction procedures
    - Document next steps for agent repository setup
    - _Requirements: 7.4, 1.2_

- [ ] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- The restructure preserves all existing functionality while establishing clean boundaries
- Agent repository creation is planned but not implemented in this phase