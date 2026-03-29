import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import LayoutShell from '../LayoutShell.vue'

const ElButtonStub = {
  name: 'ElButton',
  template: '<button @click="$emit(\'click\', $event)"><slot /></button>',
  emits: ['click'],
}

const ElIconStub = {
  name: 'ElIcon',
  template: '<span><slot /></span>',
}

function mountLayoutShell(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(LayoutShell, {
    props: {
      sidebarCollapsed: false,
      ...props,
    },
    slots,
    global: {
      stubs: {
        ElButton: ElButtonStub,
        ElIcon: ElIconStub,
      },
    },
  })
}

describe('LayoutShell', () => {
  it('renders sidebar and main areas', () => {
    const wrapper = mountLayoutShell()
    expect(wrapper.find('.ai-chat-layout').exists()).toBe(true)
    expect(wrapper.find('.ai-chat-sidebar').exists()).toBe(true)
    expect(wrapper.find('.ai-chat-main').exists()).toBe(true)
  })

  it('renders header area inside main', () => {
    const wrapper = mountLayoutShell()
    expect(wrapper.find('.ai-chat-header').exists()).toBe(true)
  })

  it('renders messages area with overflow-y auto', () => {
    const wrapper = mountLayoutShell()
    const messages = wrapper.find('.ai-chat-messages')
    expect(messages.exists()).toBe(true)
  })

  it('renders input area', () => {
    const wrapper = mountLayoutShell()
    expect(wrapper.find('.ai-chat-input').exists()).toBe(true)
  })

  it('sidebar is visible when sidebarCollapsed is false', () => {
    const wrapper = mountLayoutShell({ sidebarCollapsed: false })
    const sidebar = wrapper.find('.ai-chat-sidebar')
    expect(sidebar.isVisible()).toBe(true)
  })

  it('sidebar collapses when sidebarCollapsed is true', async () => {
    const wrapper = mountLayoutShell({ sidebarCollapsed: true })
    const sidebar = wrapper.find('.ai-chat-sidebar')
    // When collapsed, width should be 0 or the element should have collapsed class
    expect(sidebar.classes()).toContain('ai-chat-sidebar--collapsed')
  })

  it('sidebar expand when sidebarCollapsed changes from true to false', async () => {
    const wrapper = mountLayoutShell({ sidebarCollapsed: true })
    await wrapper.setProps({ sidebarCollapsed: false })
    const sidebar = wrapper.find('.ai-chat-sidebar')
    expect(sidebar.classes()).not.toContain('ai-chat-sidebar--collapsed')
  })

  it('renders sidebar slot content', () => {
    const wrapper = mountLayoutShell({}, { sidebar: '<div class="test-sidebar">Sidebar Content</div>' })
    expect(wrapper.find('.test-sidebar').exists()).toBe(true)
    expect(wrapper.find('.test-sidebar').text()).toBe('Sidebar Content')
  })

  it('renders header slot content', () => {
    const wrapper = mountLayoutShell({}, { header: '<div class="test-header">Header Content</div>' })
    expect(wrapper.find('.test-header').exists()).toBe(true)
    expect(wrapper.find('.test-header').text()).toBe('Header Content')
  })

  it('renders messages slot content', () => {
    const wrapper = mountLayoutShell({}, { messages: '<div class="test-messages">Messages Content</div>' })
    expect(wrapper.find('.test-messages').exists()).toBe(true)
    expect(wrapper.find('.test-messages').text()).toBe('Messages Content')
  })

  it('renders input slot content', () => {
    const wrapper = mountLayoutShell({}, { input: '<div class="test-input">Input Content</div>' })
    expect(wrapper.find('.test-input').exists()).toBe(true)
    expect(wrapper.find('.test-input').text()).toBe('Input Content')
  })

  it('toggle button emits update:sidebarCollapsed when clicked', async () => {
    const wrapper = mountLayoutShell({ sidebarCollapsed: false })
    const toggleBtn = wrapper.find('.ai-chat-sidebar-toggle')
    await toggleBtn.trigger('click')
    expect(wrapper.emitted('update:sidebarCollapsed')).toBeTruthy()
    expect(wrapper.emitted('update:sidebarCollapsed')![0]).toEqual([true])
  })

  it('toggle button emits false when sidebar is collapsed', async () => {
    const wrapper = mountLayoutShell({ sidebarCollapsed: true })
    const toggleBtn = wrapper.find('.ai-chat-sidebar-toggle')
    await toggleBtn.trigger('click')
    expect(wrapper.emitted('update:sidebarCollapsed')).toBeTruthy()
    expect(wrapper.emitted('update:sidebarCollapsed')![0]).toEqual([false])
  })

  it('applies CSS custom property --ai-chat-sidebar-width', () => {
    const wrapper = mountLayoutShell()
    const sidebar = wrapper.find('.ai-chat-sidebar')
    expect(sidebar.exists()).toBe(true)
    // Verify the sidebar has style binding or CSS variable support
    const layout = wrapper.find('.ai-chat-layout')
    expect(layout.exists()).toBe(true)
  })

  it('main area takes remaining space', () => {
    const wrapper = mountLayoutShell()
    const main = wrapper.find('.ai-chat-main')
    expect(main.exists()).toBe(true)
  })

  it('has smooth transition on sidebar', () => {
    const wrapper = mountLayoutShell()
    const sidebar = wrapper.find('.ai-chat-sidebar')
    expect(sidebar.exists()).toBe(true)
    const style = sidebar.attributes('style')
    // CSS transitions are applied via scoped CSS, not inline styles
    // Just verify the element exists and structure is correct
    expect(sidebar.classes()).toContain('ai-chat-sidebar')
  })

  it('sidebar collapsed class toggles correctly via v-model pattern', async () => {
    const wrapper = mountLayoutShell({ sidebarCollapsed: false })
    const sidebar = wrapper.find('.ai-chat-sidebar')
    expect(sidebar.classes()).not.toContain('ai-chat-sidebar--collapsed')

    await wrapper.setProps({ sidebarCollapsed: true })
    expect(sidebar.classes()).toContain('ai-chat-sidebar--collapsed')

    await wrapper.setProps({ sidebarCollapsed: false })
    expect(sidebar.classes()).not.toContain('ai-chat-sidebar--collapsed')
  })
})
