/**
 * Adds the WidgetBridge React Native module (Swift + ObjC bridge) to the
 * main iOS app target so JS can:
 *   - write a JSON snapshot into the shared App Group UserDefaults
 *   - reload widget timelines
 *   - start / update / end Live Activities (ActivityKit)
 *
 * After prebuild, files live in ios/FitStake/ and the pbxproj references
 * them inside the FitStake target. Re-runnable: existing entries are not
 * duplicated.
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');

const SRC_DIR = path.join(__dirname, 'native');
const FILES = ['WidgetBridge.swift', 'WidgetBridge.m'];

function copyFile(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

const withCopyBridgeFiles = (config) =>
  withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const iosDir = path.join(projectRoot, 'ios');
      const projectName =
        config.modRequest.projectName ||
        fs
          .readdirSync(iosDir)
          .find(
            (d) =>
              d !== 'Pods' &&
              !d.startsWith('.') &&
              fs.statSync(path.join(iosDir, d)).isDirectory() &&
              fs.existsSync(path.join(iosDir, d, 'AppDelegate.swift'))
          );
      if (!projectName) {
        throw new Error('[withWidgetBridge] Could not find iOS project directory');
      }
      const targetDir = path.join(iosDir, projectName);
      for (const name of FILES) {
        copyFile(path.join(SRC_DIR, name), path.join(targetDir, name));
      }
      return config;
    },
  ]);

const withAddBridgeFilesToXcode = (config) =>
  withXcodeProject(config, (config) => {
    const proj = config.modResults;
    const projectName = config.modRequest.projectName || 'FitStake';

    let nativeTarget;
    try {
      nativeTarget = proj.pbxTargetByName(projectName);
    } catch (_) {
      nativeTarget = null;
    }
    if (!nativeTarget) {
      const targets = proj.pbxNativeTargetSection();
      for (const key of Object.keys(targets)) {
        if (key.endsWith('_comment')) continue;
        const t = targets[key];
        if (t && t.name === projectName) {
          nativeTarget = { uuid: key, target: t };
          break;
        }
      }
    }
    if (!nativeTarget) {
      console.warn('[withWidgetBridge] Could not find native target for', projectName);
      return config;
    }
    const targetUuid = nativeTarget.uuid;

    const groupKey = proj.findPBXGroupKey({ name: projectName }) ||
                     proj.findPBXGroupKey({ path: projectName });
    if (!groupKey) {
      console.warn('[withWidgetBridge] Could not find PBXGroup for', projectName);
      return config;
    }

    const existing = new Set();
    const buildFiles = proj.pbxBuildFileSection();
    for (const key of Object.keys(buildFiles)) {
      const bf = buildFiles[key];
      if (bf && typeof bf === 'object' && bf.fileRef_comment) {
        existing.add(bf.fileRef_comment);
      }
    }

    for (const name of FILES) {
      if (existing.has(name)) continue;
      proj.addSourceFile(
        `${projectName}/${name}`,
        { target: targetUuid },
        groupKey
      );
    }

    return config;
  });

module.exports = function withWidgetBridge(config) {
  config = withCopyBridgeFiles(config);
  config = withAddBridgeFilesToXcode(config);
  return config;
};
