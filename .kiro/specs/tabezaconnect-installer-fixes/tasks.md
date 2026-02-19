# TabezaConnect Installer Fixes - Tasks

## 1. Fix Admin Rights (Error 5)
- [x] 1.1 Update Inno Setup script with proper UAC elevation settings
- [x] 1.2 Add safe temp directory handling with retry logic
- [x] 1.3 Test installation with and without admin rights

## 2. Add Terms & Conditions
- [x] 2.1 Create terms acceptance page with checkbox in Inno Setup
- [x] 2.2 Add validation to block installation without acceptance
- [x] 2.3 Implement terms acceptance logging to file

## 3. Update Branding to "Tabeza POS Connect"
- [x] 3.1 Update all user-facing names in Inno Setup script
- [x] 3.2 Update service display name
- [x] 3.3 Verify technical names remain "TabezaConnect"

## 4. Improve Bar ID Input
- [x] 4.1 Create Bar ID input page with validation
- [x] 4.2 Save Bar ID to config.json file

## 5. Build and Test
- [x] 5.1 Compile installer as v1.3.0
- [ ] 5.2 Test on Windows 10/11 with antivirus
- [ ] 5.3 Verify all acceptance criteria met

## 6. Release
- [ ] 6.1 Create GitHub release v1.3.0
- [x] 6.2 Update download links in staff app (4 files)

## Notes
- Focus on fixing "Error 5: Access is denied" first
- Test with Avast/Defender active
- Keep backup of working installer
