# Generated migration to add default value for avatar field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('db', '0115_auto_20260105_1406'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='avatar',
            field=models.TextField(blank=True, default=''),
        ),
    ]
