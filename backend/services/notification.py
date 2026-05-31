import logging
logger = logging.getLogger(__name__)

# Notification stubs — configure Telegram bot token in .env to enable
async def notify_new_request(request, reporter):
    pass

async def notify_status_change(request, old_status, changed_by):
    pass
