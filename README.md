# 库房三维设计器

布置货架与库区，导出 JSON、库位表和 GLB，供 3D 库房看板加载。

```bash
pnpm install
pnpm dev
```

## 目录结构

```text
src/
  components/   Vue 界面
  domain/       场景数据、目录常量、几何与编辑状态
  scene/        Three.js 建模、视口与 GLB 导出
  io/           导入导出与视口桥接
  examples/     看板 Demo 打包
```

## 导出

- `名称.warehouse.json`：看板主文件。`slots` 是扁平库位表，用 `code` 对齐仓储系统，用 `position` 放置货物。
- `名称-库位.csv`：同一份库位清单，方便对表。
- `名称.glb`：可视化模型。原点在库房地面中心，1 单位 = 1 米。

JSON 坐标原点在地面西南角，X 沿长度，Z 沿进深，Y 向上。用 three.js 时：

```text
threeX = x - floor.width / 2
threeZ = z - floor.depth / 2
```

货架编码会变成库位前缀。编码 `A-01`、2 列 3 层，会生成 `A-01-01-01` 到 `A-01-02-03`。

## 看板示例

设计器顶部的「使用示例」里有 Vue 3 / React 两套 TypeScript Demo，下载的 zip 已包含与设计器同款的 `warehouse.json` 和 `warehouse.glb`，外观与设计器一致。解压后：

```bash
pnpm install
pnpm dev
```

换成自己的场景时，用设计器导出的 JSON / GLB 替换 `public/` 即可。

## 协议

本项目以 [MIT](LICENSE) 协议开源。
