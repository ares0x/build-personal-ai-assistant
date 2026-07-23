import { defineConfig } from "vitepress";

export default defineConfig({
    base: "/build-personal-ai-assistant/",
    title: "build-personal-ai-assistant",
    description: "从零构建个人 AI 助理 Harness 的实战教程",
    lang: "zh-CN",

    themeConfig: {
        // 顶部导航
        nav: [
            { text: "教程", link: "/l1/00-前言" },
            {
                text: "GitHub",
                link: "https://github.com/ares0x/build-personal-ai-assistant",
            },
        ],

        // 侧边栏
        sidebar: [
            {
                text: "L1: 基础核心篇 (Harness 101)",
                collapsed: false,
                items: [
                    { text: "00. 前言", link: "/l1/00-前言" },
                    { text: "01. 项目定位与架构设计", link: "/l1/01-项目定位与架构设计" },
                    { text: "02. 基础脚手架搭建", link: "/l1/02-基础脚手架搭建" },
                    { text: "03. 最小可用核心", link: "/l1/03-最小可用核心" },
                    { text: "04. 分层 Memory", link: "/l1/04-分层Memory" },
                    { text: "05. 交互式 CLI", link: "/l1/05-交互式CLI" },
                    { text: "06. 代码重构实践", link: "/l1/06-代码重构实践" },
                    { text: "07. 接入真实 LLM", link: "/l1/07-接入真实LLM" },
                    { text: "08. Skills 系统", link: "/l1/08-Skills系统" },
                    { text: "09. 持久化与 Session 管理", link: "/l1/09-持久化与Session管理" },
                    { text: "10. 多渠道支持", link: "/l1/10-多渠道支持" },
                    { text: "11. 权限安全与可扩展性", link: "/l1/11-权限安全与可扩展性" },
                    { text: "12. 总结与后续演进", link: "/l1/12-总结与后续演进" },
                ],
            },
            {
                text: "L2: 进阶实战篇 (Harness 201)",
                collapsed: false,
                items: [
                    { text: "Phase A：Harness 地基", link: "/l2/地基" },
                ],
            },
        ],

        // 社交链接
        socialLinks: [
            {
                icon: "github",
                link: "https://github.com/ares0x/build-personal-ai-assistant",
            },
        ],

        // 大纲
        outline: {
            label: "本页目录",
            level: [2, 3],
        },

        // 最后更新时间
        lastUpdated: {
            text: "最后更新于",
            formatOptions: {
                dateStyle: "short",
                timeStyle: "medium",
            },
        },

        // 文档页脚
        docFooter: {
            prev: "上一页",
            next: "下一页",
        },

        // 搜索（本地）
        search: {
            provider: "local",
        },
    },

    // 清理 URL（去掉 .html）
    cleanUrls: true,

    // 最后更新时间
    lastUpdated: true,
});
