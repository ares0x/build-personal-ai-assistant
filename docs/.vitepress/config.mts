import { defineConfig } from "vitepress";

export default defineConfig({
    base: "/build-personal-ai-assistant/",
    title: "build-personal-ai-assistant",
    description: "从零构建个人 AI 助理 Harness 的实战教程",
    lang: "zh-CN",

    themeConfig: {
        // 顶部导航
        nav: [
            { text: "教程", link: "/00-前言" },
            {
                text: "GitHub",
                link: "https://github.com/ares0x/build-personal-ai-assistant",
            },
        ],

        // 侧边栏
        sidebar: [
            {
                text: "开始",
                items: [
                    { text: "00. 前言", link: "/00-前言" },
                    { text: "01. 项目定位与架构设计", link: "/01-项目定位与架构设计" },
                    { text: "02. 基础脚手架搭建", link: "/02-基础脚手架搭建" },
                ],
            },
            {
                text: "核心实现",
                items: [
                    { text: "03. 最小可用核心", link: "/03-最小可用核心" },
                    { text: "04. 分层 Memory", link: "/04-分层Memory" },
                    { text: "05. 交互式 CLI", link: "/05-交互式CLI" },
                    { text: "06. 代码重构实践", link: "/06-代码重构实践" },
                ],
            },
            {
                text: "进阶",
                items: [
                    { text: "07. 接入真实 LLM", link: "/07-接入真实LLM" },
                    { text: "08. Skills 系统", link: "/08-Skills系统" },
                    { text: "09. 持久化与 Session 管理", link: "/09-持久化与Session管理" },
                    { text: "10. 多渠道支持", link: "/10-多渠道支持" },
                    { text: "11. 权限安全与可扩展性", link: "/11-权限安全与可扩展性" },
                    { text: "12. 总结与后续演进", link: "/12-总结与后续演进" },
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
